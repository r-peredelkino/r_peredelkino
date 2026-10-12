"""Build revision29 from recorded source pixels, preserving the fixed district map.

This is a source reconstruction, not a survey. The fixed OSM road axes and the
already reviewed building footprints are the destination controls. The original
pixel observations, camera assumptions and smooth registration stay inspectable.
"""
from pathlib import Path
import json, math, copy, hashlib, sys
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import gaussian_filter1d
from shapely.geometry import Polygon, LineString, Point, MultiPolygon, GeometryCollection
from shapely.ops import unary_union, nearest_points
from shapely import make_valid

DEST=Path(__file__).resolve().parents[1]
QA=DEST/'tools/forecourt-v29'
DIST=DEST/'dist'
sys.path.insert(0,str(QA))
from projection import pixel_to_world, world_to_pixel, SCALE, write_camera

def load_js(path):
    s=Path(path).read_text();return json.loads(s[s.index('={')+1:s.rfind(';')])

def compact(data):return json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)

def write_js(name,var,data,comment):
    (DIST/name).write_text('// @r_peredelkino · '+comment+'\nexport const '+var+'='+compact(data)+';\n')

def load_optional(name,default):
    path=QA/name
    return json.loads(path.read_text()) if path.exists() else default

source_landscape=json.loads((QA/'forecourt-landscape-pixels.json').read_text())
source_architecture=load_optional('forecourt-architecture-pixels.json',{})
source_roads=json.loads((QA/'forecourt-road-pixels.json').read_text())
roads=json.loads((QA/'road-data.json').read_text())
footprints=load_js(DIST/'complex-footprints.js')
legacy=load_js(QA/'baseline-public-realm-layout-v28.js')
podium=Polygon(footprints['podium']['outer'],footprints['podium'].get('holes',[]))
podium_line=LineString(footprints['podium']['outer'])
road_items={r['sourceWayId']:r for r in roads}
front_roads=[road_items[n] for n in [884735967,49155461,128070797] if n in road_items]
front_axis=[]
for r in front_roads:
    for x,y,z in r['pointsWorld']:
        if not front_axis or np.linalg.norm(np.array([x,z])-front_axis[-1])>.001:front_axis.append(np.array([x,z]))
front_line=LineString(front_axis)
front_width=road_items[49155461]['width']

def closest_front(p):
    s=front_line.project(Point(p));q=np.array(front_line.interpolate(s).coords[0])
    p0=np.array(front_line.interpolate(max(0,s-.08)).coords[0])
    p1=np.array(front_line.interpolate(min(front_line.length,s+.08)).coords[0])
    tangent=(p1-p0)/(np.linalg.norm(p1-p0) or 1)
    normal=np.array([-tangent[1],tangent[0]])
    return q,tangent,normal,s

control_source=[];control_target=[];control_records=[]
for item in source_roads['roadReference']['siteCurbTop']:
    for pixel in item['points']:
        p=np.array(pixel_to_world(pixel,item.get('sourceHeightMeters',0),item['source'],correct=False))
        q,t,n,s=closest_front(p)
        target=q+n*(front_width/2+.16)
        control_source.append(p);control_target.append(target)
        control_records.append({'kind':'road-curb','source':item['source'],'pixel':pixel,'rawWorld':p.tolist(),'targetWorld':target.tolist(),'roadWayId':49155461})

# The lower glass/paving seam is used, not the high white canopy or reflected LED.
# Visible seam anchors on the analytic perspective. Occluded gaps are not controls.
facade_pixels=[(748,229),(790,255),(848,274),(901,295),(948,315),(984,345),
               (997,489),(1022,582),(1105,742),(1198,842),(1316,938),(1485,1064),(1661,1180)]
gallery=source_architecture.get('officeGallery',{})
if gallery.get('groundFacadeAnchors'):
    proposed=gallery['groundFacadeAnchors']
    if all(isinstance(p,list) and len(p)==2 for p in proposed):facade_pixels=proposed+facade_pixels[6:]
for pixel in facade_pixels:
    p=np.array(pixel_to_world(pixel,0,correct=False))
    target=np.array(nearest_points(Point(p),podium_line)[1].coords[0])
    control_source.append(p);control_target.append(target)
    control_records.append({'kind':'commercial-paving-seam','source':'node1-perspective','pixel':list(pixel),'rawWorld':p.tolist(),'targetWorld':target.tolist()})

cs=np.array(control_source);ct=np.array(control_target)
registration=RBFInterpolator(cs,ct-cs,kernel='thin_plate_spline',degree=1,smoothing=.25)

def registered(points):
    p=np.array(points,dtype=float).reshape(-1,2)
    return np.round(p+registration(p),5).tolist()

def project_points(points,height=0,source='perspective'):
    return registered([pixel_to_world(p,height,source,correct=False) for p in points])

def project_point(point,height=0,source='perspective'):
    return project_points([point],height,source)[0]

def project_feature(raw,inherited_height=0,inherited_source='perspective'):
    """Retain the source record while replacing declared pixel coordinate fields."""
    if not isinstance(raw,dict):return copy.deepcopy(raw)
    height=raw.get('sourceHeightMeters',inherited_height)
    source=raw.get('source',inherited_source)
    if not isinstance(source,str):source=inherited_source
    result={}
    for k,v in raw.items():
        if k in ['controlPoints','pixelControlPoints','sourceHeightMeters','source','perspectivePoints','perspectiveCenter','perspectiveBase']:
            continue
        if k in ['outer','points','groundFacadeAnchors'] and isinstance(v,list):
            result[k]=project_points(v,height,source) if v else []
        elif k=='holes':result[k]=[project_points(r,height,source) for r in v]
        elif k in ['base','center','forward','forwardPoint','foot','head'] and isinstance(v,list) and len(v)==2:
            result[k]=project_point(v,height,source)
        elif k=='pixel' and isinstance(v,list) and len(v)==2:
            result['x'],result['z']=project_point(v,height,source)
        elif k.endswith('Meters') and isinstance(v,(int,float)):
            result[k]=round(v*SCALE,5)
        elif isinstance(v,list):result[k]=[project_feature(p,height,source) if isinstance(p,dict) else copy.deepcopy(p) for p in v]
        elif isinstance(v,dict):result[k]=project_feature(v,height,source)
        else:result[k]=copy.deepcopy(v)
    return result

def polygon(record):return make_valid(Polygon(record['outer'],record.get('holes',[])))

def polygons(geometry):
    if geometry.is_empty:return []
    if isinstance(geometry,Polygon):return [geometry]
    return [p for g in getattr(geometry,'geoms',[]) for p in polygons(g)]

def polygon_data(poly):
    poly=poly.simplify(.009,preserve_topology=True)
    return {'outer':[[round(x,5),round(z,5)] for x,z in list(poly.exterior.coords)[:-1]],
            'holes':[[[round(x,5),round(z,5)] for x,z in list(r.coords)[:-1]] for r in poly.interiors]}

def line_parts(geometry):
    if geometry.is_empty:return []
    if isinstance(geometry,LineString):return [geometry]
    return [p for g in getattr(geometry,'geoms',[]) for p in line_parts(g)]

landscape={k:[project_feature(v) for v in source_landscape.get(k,[])] for k in ['islands','lines','benches','planters','pebbles','mediaColumns','trees','cafes']}
architecture=project_feature(source_architecture)
roadside={k:[project_feature(v) for v in source_roads.get(k,[])] for k in ['areas','curbs','markings','cars','lamps','openings']}
if (QA/'convert_architecture.py').exists():
    from convert_architecture import convert_architecture
    architecture=convert_architecture(source_architecture,project_points,SCALE)

# This visible edge is the gallery handrail top; the band below is at the
# existing first commercial-floor divider. It is not a freestanding ellipse.
if gallery.get('outerEdge'):
    edge_raw=project_points(gallery['outerEdge'],5.2)
    front_edge=[];back_edge=[]
    for p in edge_raw:
        p=np.array(p);back=np.array(nearest_points(Point(p),podium_line)[1].coords[0]);delta=p-back
        d=np.linalg.norm(delta)
        if d<1e-7:continue
        # The opaque slab joins the actual facade. The trace controls its curved
        # span and overhang; inside/outsize registration artefacts are bounded.
        if podium.contains(Point(p)):delta=-delta
        delta=delta/(d or 1)*max(.72,min(1.9,d))
        front_edge.append((back+delta).tolist());back_edge.append((back-delta*.035).tolist())
    # Smooth the continuous fascia, including the joins between pre-existing
    # facade segments, instead of inheriting their coarse polygon corners.
    rough_edge=LineString(front_edge)
    dense=np.array([rough_edge.interpolate(s).coords[0] for s in np.linspace(0,rough_edge.length,max(40,int(rough_edge.length/.20)))])
    dense=gaussian_filter1d(dense,2.3,axis=0,mode='nearest')
    front_edge=dense.tolist()
    back_edge=[list(nearest_points(Point(p),podium_line)[1].coords[0]) for p in front_edge]
    gallery_polygon=make_valid(Polygon(front_edge+back_edge[::-1]))
    gps=polygons(gallery_polygon)
    if gps:
        architecture['gallery']={'id':'office-curved-white-gallery',
          **polygon_data(max(gps,key=lambda p:p.area)),'frontEdge':front_edge,
          'walkY':3.84,'slabThickness':.18,'fasciaHeight':.58,'railingHeight':.855,
          'sourceInterpretation':'Curved gallery above the shops; upper handrail edge traced at estimated 5.2 m, not a ground-plane roof outline.'}
        gl=LineString(front_edge);signs=[]
        for index,u in enumerate([.20,.51,.80]):
            p=np.array(gl.interpolate(gl.length*u).coords[0]);back=np.array(nearest_points(Point(p),podium_line)[1].coords[0]);n=p-back;n=n/(np.linalg.norm(n) or 1)
            signs.append({'id':'gallery-bakery-sign-'+str(index+1),'x':float(p[0]+n[0]*.055),'z':float(p[1]+n[1]*.055),'nx':float(n[0]),'nz':float(n[1]),'length':6.3,'width':5.4,'signY':3.55,'labelIndex':4,'gallerySign':True})
        architecture['gallery']['signs']=signs

for a in roadside['areas']:
    a['surfaceY']=-.48 if a['kind']=='parking' else -.30
for m in roadside['markings']:
    m['width']=m.pop('widthMeters',.09);m['surfaceY']=-.462
for c in roadside['cars']:
    c['x'],c['z']=c.pop('center');forward=c.pop('forward')
    c['angle']=math.atan2(forward[0]-c['x'],forward[1]-c['z'])
    for dim in ['length','width','height']:c[dim]=c.pop(dim+'Meters')
for raw,lamp in zip(source_roads.get('lamps',[]),roadside['lamps']):
    lamp['x'],lamp['z']=project_point(raw['basePixel'],0,raw['source'])
    q,t,n,s=closest_front([lamp['x'],lamp['z']])
    lamp['angle']=math.atan2(-n[0],-n[1]);lamp['height']=lamp.pop('heightMeters')
    lamp.pop('basePixel',None)

# The parking is outside the facade registration controls. Fit both observed
# roadside edges separately, retain the original poses, and record every
# bounded placement needed to reconcile the published aerial with fixed roads.
from convert_roadside import refit_roadside
roadside, roadside_fit = refit_roadside(source_roads, roadside, roads, SCALE)

# A regular four-by-four installation is visible in the source. Remove tiny
# manual-pixel jitter with a least-squares grid while retaining its measured span.
grid=[p for p in landscape['mediaColumns'] if 'row' in p and 'column' in p]
if len(grid)==16:
    design=np.array([[1,p['row'],p['column']] for p in grid]);observed=np.array([p['base'] for p in grid]);fit=np.linalg.lstsq(design,observed,rcond=None)[0]
    adjusted=design@fit
    for p,old,new in zip(grid,observed,adjusted):
        p['base']=np.round(new,5).tolist();p['gridFitAdjustment']=round(float(np.linalg.norm(new-old)),5)

# All clipping uses actual rendered road widths, never a drawing over the traffic.
road_shapes=[]
for r in roads:
    pts=[[p[0],p[2]] for p in r['pointsWorld']]
    road_shapes.append(LineString(pts).buffer(r['width']/2+.10,cap_style=2,join_style=2))
road_cut=unary_union(road_shapes)
parking_cut=unary_union([make_valid(Polygon(a.get('points',a.get('outer',[])))) for a in roadside['areas']+roadside['openings'] if len(a.get('points',a.get('outer',[])))>=3])
road_cut=unary_union([road_cut,parking_cut])

# Targeted front-zone replacement. The southern edge is the actual image limit;
# established landscape beyond it remains present rather than reimagined.
region_pixels=[[279,249],[638,139],[755,210],*facade_pixels,[1700,1200],[1215,1200],[753,744],[519,537],[350,355]]
region=make_valid(Polygon(project_points(region_pixels))).buffer(.7,join_style=2)
known_bounds=unary_union([polygon(v) for v in landscape['islands']]+[polygon(v) for v in landscape['planters']])
region=unary_union([region,known_bounds.buffer(.65)])
region=unary_union(polygons(region))
clear_region=region.buffer(.65)

# Boolean-cut old planted islands and their associated furniture, not only the
# asphalt. This removes hidden legacy collisions as well as visible duplicates.
old_counts={k:len(legacy[k]) for k in ['islands','trees','matureTrees','shrubs','flowers','cafes','pavilions','lamps','benches','lightLines']}
filtered_islands=[]
for old in legacy['islands']:
    for i,p in enumerate(polygons(polygon(old).difference(unary_union([clear_region,road_cut.buffer(.35)])))):
        if p.area<1.2:continue
        result={**old,**polygon_data(p)}
        if 'id' in old:result['id']=str(old['id'])+('-part'+str(i+1) if i else '')
        filtered_islands.append(result)
legacy['islands']=filtered_islands
old_planting=unary_union([polygon(p) for p in filtered_islands])
for key in ['trees','matureTrees','shrubs','flowers']:
    clearance=1.5 if key in ['trees','matureTrees'] else .30
    legacy[key]=[p for p in legacy[key] if not clear_region.covers(Point(p[:2])) and not road_cut.buffer(clearance).covers(Point(p[:2])) and (key=='matureTrees' or old_planting.buffer(.15).covers(Point(p[:2])))]
for key in ['cafes','pavilions','lamps']:
    legacy[key]=[p for p in legacy[key] if not clear_region.covers(Point(p['x'],p['z'])) and not road_cut.buffer(1).covers(Point(p['x'],p['z'])) and (key!='pavilions' or p.get('id') not in ['office-plaza','front-lounge'])]
for key in ['benches','lightLines']:
    result=[]
    for old in legacy[key]:
        line=LineString(old['points']);trim=line.difference(unary_union([clear_region,road_cut.buffer(.4)]))
        for i,part in enumerate(line_parts(trim)):
            if part.length<.25:continue
            item={**old,'points':[[round(x,5),round(z,5)] for x,z in part.coords]}
            if key=='benches':
                seat=polygon(old['seat']).difference(unary_union([clear_region,road_cut.buffer(.4)]))
                ps=polygons(seat)
                if not ps:continue
                item['seat']=polygon_data(max(ps,key=lambda p:p.area))
            result.append(item)
    legacy[key]=result

promenade=unary_union([polygon(legacy['promenade']),region]).difference(road_cut).difference(podium)
curb_line=LineString([r['targetWorld'] for r in control_records if r['kind']=='road-curb'])
# Keep the existing road datum and join its 0.20 m curb to the existing plaza
# datum through a short graded shoulder. This section is a model fit; no
# surveyed elevations are available in the panorama. All planted beds stay
# beyond this strip, and light inlays sample the same rendered surface.
grade_width=3.0
grade=curb_line.buffer(grade_width,cap_style=2,join_style=2).intersection(promenade)
promenade=promenade.difference(grade)
def ground_height(x,z):
    distance=curb_line.distance(Point(x,z))
    return -.30+min(1,distance/grade_width)*.287
for lamp in architecture.get('lamps',[]):lamp['baseY']=round(ground_height(lamp['x'],lamp['z'])+.013,5)
for lamp in roadside.get('lamps',[]):lamp['baseY']=round(ground_height(lamp['x'],lamp['z']),5)
paving_parts=sorted(polygons(promenade),key=lambda p:p.area,reverse=True)
legacy['promenade']=polygon_data(paving_parts[0]);legacy['promenadeParts']=[polygon_data(p) for p in paving_parts]
boundary=unary_union([polygon(legacy['boundary']),region]).difference(road_cut)
legacy['boundary']=polygon_data(max(polygons(boundary),key=lambda p:p.area))
legacy['boundaryExtensions']=[polygon_data(p) for p in polygons(boundary) if p.area>1]

# Road-facing curb follows the same fixed axis. Construction at the street join
# has explicit openings from the image; no planter or paving covers a lane.
legacy_curb=LineString(legacy['curb']).difference(front_line.buffer(front_width/2+8)).difference(clear_region).difference(road_cut)
legacy['curbParts']=[[[round(x,5),round(z,5)] for x,z in l.coords] for l in line_parts(legacy_curb) if l.length>1]
legacy['curb']=[]
core_parts=polygons(polygon(footprints['site']).difference(road_cut).difference(grade))
legacy.pop('fountain',None)

# Continuous dark cafe apron, following the actual facade seam and the explicit
# furniture anchors. Only its observed outward extent is reconstructed here.
cafe_roof_shapes=[polygon(r) for c in landscape['cafes'] for r in c.get('roofs',[])]
cafe_points=[Point(p['center']) for c in landscape['cafes'] for p in c.get('tables',[])+c.get('chairs',[])]
cafe_zone=unary_union([p.buffer(.6) for p in cafe_points]+cafe_roof_shapes)
facade_seam=LineString([r['targetWorld'] for r in control_records if r['kind']=='commercial-paving-seam'])
apron=unary_union([facade_seam.buffer(2.3),cafe_zone]).intersection(region).difference(podium.buffer(.01)).difference(road_cut)
# Avoid rounded disks in the open square: the apron is constrained to the
# frontage and its narrow cafe projections, with actual garden pockets removed.
apron=apron.difference(unary_union([polygon(i) for i in landscape['islands']]))
cafe_layout={'cafes':landscape['cafes'],'apronParts':[polygon_data(p) for p in polygons(apron) if p.area>.1]}

# Runtime dimensions keep explicit model units. Pixel records remain in tools/.
reference={'version':29,'source':{'url':'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/',
  'catalogDate':'2026-06-29','shootingDateVerified':False,'kind':'Developer-proposed landscape in six-scene panorama tour',
  'node':'node1','nightNode':'node2','sourceImageSHA256':source_landscape['source']['sha256'],
  'geometryMethod':'Traced source pixels, ray-plane projection at declared feature height, smooth fit to fixed road curb and existing facade seam',
  'accuracy':'Reference reconstruction; unmeasured dimensions and occluded parts are not certified 1:1',
  'modelUnitsPerMeter':SCALE},
  'region':[polygon_data(p) for p in polygons(region)],'landscape':landscape,'architecture':architecture,'roadside':roadside,'cafes':cafe_layout,
  'frontageCurb':[[round(x,5),round(z,5)] for x,z in curb_line.coords],
  'gradedPavingParts':[polygon_data(p) for p in polygons(grade)],
  'groundSection':{'width':grade_width,'curbY':-.30,'plazaY':-.013,'roadY':-.50,'measured':False,'purpose':'Continuous model-datum transition at the fixed road curb'},
  'corePavingParts':[polygon_data(p) for p in core_parts],
  'registration':{'type':'thin-plate displacement','smoothing':.25,'controlCount':len(cs),'maxControlResidual':float(np.linalg.norm(cs+registration(cs)-ct,axis=1).max()),
    'controls':control_records,'camera':write_camera()},
  'legacyCountsBefore':old_counts,'legacyCountsAfter':{k:len(legacy[k]) for k in old_counts},
}
write_js('public-realm-layout.js','publicRealmLayout',legacy,'Reference promenade with road-safe forecourt replacement · v29.')
write_js('forecourt-reference-data.js','forecourtReference',reference,'Traced June29 forecourt, white canopy, media installation, planted islands and parking · v29.')
(QA/'projected-forecourt.json').write_text(json.dumps(reference,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'version':29,'controlCount':len(cs),'maxControlResidual':reference['registration']['maxControlResidual'],
 'regionArea':region.area,'promenadeArea':promenade.area,'roadPavingOverlap':promenade.intersection(road_cut).area,
 'coreRoadPavingOverlap':unary_union(core_parts).intersection(road_cut).area,
 'gradedRoadPavingOverlap':grade.intersection(road_cut).area,
 'sourceCounts':{k:len(v) for k,v in landscape.items()},'legacyCountsBefore':old_counts,'legacyCountsAfter':reference['legacyCountsAfter'],
 'architectureReady':bool(source_architecture),'roadsideReady':source_roads.get('complete',False)},ensure_ascii=False,indent=2))
