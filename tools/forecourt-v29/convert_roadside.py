"""Bound the observed parking reconstruction by the unchanged runtime roads.

The source observations remain in forecourt-road-pixels.json. This converter
records every world-space correction; it never changes roads or removes cars.
"""
from pathlib import Path
import copy, json, math
import numpy as np
from scipy.interpolate import RBFInterpolator
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union, nearest_points
from shapely import make_valid
from shapely.prepared import prep
from shapely.affinity import translate
from projection import pixel_to_world

QA = Path(__file__).resolve().parent

def _polygons(g):
    if g.is_empty:return []
    if isinstance(g,Polygon):return [g]
    return [p for c in getattr(g,'geoms',[]) for p in _polygons(c)]

def _lines(g):
    if g.is_empty:return []
    if isinstance(g,LineString):return [g]
    return [p for c in getattr(g,'geoms',[]) for p in _lines(c)]

def _shape(a):return make_valid(Polygon(a['points'],a.get('holes',[])))

def _record(poly):
    return {'points':[[round(x,5),round(z,5)]for x,z in list(poly.exterior.coords)[:-1]],
            'holes':[[[round(x,5),round(z,5)]for x,z in list(r.coords)[:-1]]for r in poly.interiors]}

def _body(car,x=None,z=None,angle=None,width_factor=1.10):
    x=car['x']if x is None else x;z=car['z']if z is None else z
    angle=car['angle']if angle is None else angle;c,s=math.cos(angle),math.sin(angle)
    w=car['width']*width_factor;l=car['length']
    return Polygon([(x+c*xx+s*zz,z-s*xx+c*zz)for xx,zz in [(-w/2,-l/2),(w/2,-l/2),(w/2,l/2),(-w/2,l/2)]])

def refit_roadside(source,projected,roads,scale):
    """Return a copy of normalised projected roadside data and complete fit notes."""
    out=copy.deepcopy(projected)
    road_by_id={r['sourceWayId']:r for r in roads}
    controls=[]
    observations=json.loads((QA/'parking-fit-controls.json').read_text())['controls']
    for obs in observations:
        road=road_by_id[obs['roadWayId']]
        line=LineString([(p[0],p[2])for p in road['pointsWorld']])
        raw=np.array(pixel_to_world(obs['pixel'],0,obs['source'],correct=False))
        q=np.array(nearest_points(Point(raw),line)[1].coords[0]);normal=raw-q
        normal/=np.linalg.norm(normal)
        target=q+normal*(road['width']/2+.055)
        controls.append({**obs,'rawWorld':raw.tolist(),'targetWorld':target.tolist()})
    src=np.array([c['rawWorld']for c in controls]);dst=np.array([c['targetWorld']for c in controls])
    fit=RBFInterpolator(src,dst-src,kernel='thin_plate_spline',degree=1,smoothing=.25)
    seam_values=sorted({p[1] for cat in ['areas','curbs','openings'] for item in source.get(cat,[]) if item.get('source')=='node1-face5' for p in item.get('points',[]) if abs(p[0])<.001})

    def project(points,height,source_id):
        rays=[]
        for p in points:
            # The hand-traced crop boundaries share one physical seam. Use its
            # recorded face5 edge once for both sides, removing a subpixel crack.
            if source_id=='node1-face3'and abs(p[1]-3500)<.001:
                yy=3500-p[0];nearest=min(seam_values,key=lambda y:abs(y-yy))if seam_values else yy
                if abs(nearest-yy)<=2:yy=nearest
                rays.append(pixel_to_world([0,yy],height,'node1-face5',correct=False))
            else:rays.append(pixel_to_world(p,height,source_id,correct=False))
        raw=np.array(rays)
        return np.round(raw+fit(raw),5).tolist()

    # Forecourt office parking and the seven frontage lamps keep the caller's fit.
    # Parking between the two roads gets its own measured-edge registration.
    for category in ['areas','curbs','openings']:
        obs_by_id={x['id']:x for x in source.get(category,[])}
        for item in out.get(category,[]):
            obs=obs_by_id.get(item['id'])
            if obs and not item['id'].startswith('office'):
                item['points']=project(obs['points'],obs.get('sourceHeightMeters',0),obs['source'])
                item['sourceId']=item['id']
    obs_by_id={x['id']:x for x in source.get('cars',[])}
    for car in out.get('cars',[]):
        obs=obs_by_id[car['id']]
        if not car['id'].startswith('office'):
            p,f=project([obs['center'],obs['forward']],obs.get('sourceHeightMeters',0),obs['source'])
            car['x'],car['z']=p;car['angle']=math.atan2(f[0]-p[0],f[1]-p[1])
        for k in ['length','width','height']:car[k]=round(obs[k+'Meters']*scale,5)
        car['sourcePose']={k:car[k]for k in ['x','z','angle','length','width','height']}

    corridors=[]
    for road in roads:
        line=LineString([(p[0],p[2])for p in road['pointsWorld']])
        corridors.append(line.buffer(road['width']/2,cap_style=2,join_style=1))
    road_surface=unary_union(corridors)
    road_clearance=road_surface.buffer(.065)
    before_area=sum(_shape(a).area for a in out['areas'])

    # Driveway aprons are visible ground surfaces as well as curb reservations.
    additions=[{**copy.deepcopy(a),'id':a['id']+'-apron','sourceId':a['id'],
                'kind':'parking','surfaceY':-.48}for a in out.get('openings',[])]
    clipped=[]
    for item in out['areas']+additions:
        parts=sorted(_polygons(_shape(item).difference(road_clearance)),key=lambda p:-p.area)
        for i,part in enumerate(parts):
            if part.area<.025:continue
            clipped.append({**item,**_record(part),'id':item['id']if i==0 else item['id']+f'-part-{i+1:02d}',
                            'sourceId':item.get('sourceId',item['id'])})
    out['areas']=clipped
    clipped_curbs=[]
    for curb in out.get('curbs',[]):
        points=curb['points'];count=len(points)if curb.get('closed')else len(points)-1
        segments=[]
        for i in range(count):
            j=(i+1)%len(points)
            if [i,j]in curb.get('omitEdges',[])or[j,i]in curb.get('omitEdges',[]):continue
            segments+=_lines(LineString([points[i],points[j]]).difference(road_surface.buffer((curb.get('width',.13))/2+.015)))
        for i,line in enumerate(segments):
            if line.length<.03:continue
            item={k:v for k,v in curb.items()if k not in ['points','closed','omitEdges']}
            clipped_curbs.append({**item,'id':curb['id']+f'-segment-{i+1:02d}','sourceId':curb.get('sourceId',curb['id']),
                                  'points':[[round(x,5),round(z,5)]for x,z in line.coords],'closed':False})
    out['curbs']=clipped_curbs

    parking=unary_union([_shape(a)for a in out['areas']if a['kind']=='parking'])
    walks=unary_union([_shape(a)for a in out['areas']if a['kind']!='parking'])
    available=parking.difference(walks.buffer(.025)).difference(road_surface.buffer(.11)).buffer(-.018)
    markings={m['id']:m for m in out.get('markings',[])}
    body_records=[];adjustments=[];failed=[]
    office_pad=unary_union([_shape(a)for a in out['areas']if a.get('sourceId',a['id'])=='office-nine-bay-pad'])
    grid_cache={}
    for car in out.get('cars',[]):
        original={k:car[k]for k in ['x','z','angle']}
        allowed=available
        bay=car.get('bayNumber')
        bay_shape=None
        if bay is not None:
            a=markings.get(f'office-bay-boundary-{bay:02d}');b=markings.get(f'office-bay-boundary-{bay+1:02d}')
            if a and b:
                bay_shape=make_valid(Polygon([a['points'][0],b['points'][0],b['points'][-1],a['points'][-1]]))
                # The paint is a bay divider, not a wall at the bumper. Retain
                # its side boundaries and centre identity; permit normal front
                # or rear overhang past a divider's end only within the pad.
                v=np.array(a['points'][-1])+np.array(b['points'][-1])-np.array(a['points'][0])-np.array(b['points'][0])
                v=v/np.linalg.norm(v)*1.1
                corridor=Polygon([np.array(a['points'][0])-v,np.array(b['points'][0])-v,np.array(b['points'][-1])+v,np.array(a['points'][-1])+v])
                allowed=make_valid(corridor).intersection(office_pad)
        permitted=prep(allowed)
        def clear(x,z):
            body=_body(car,x,z)
            if bay_shape is not None and not bay_shape.covers(Point(x,z)):return None
            if not permitted.covers(body):return None
            if any(body.distance(other)<.075 for other in body_records):return None
            return body
        result=clear(car['x'],car['z']);chosen=None
        # Deterministic local search retains source heading and prefers moving
        # forward/back within the parking row over crossing into another bay.
        if result is None:
            for radius in [2.0,4.0,8.0,12.0]:
                if radius not in grid_cache:
                    steps=np.arange(-radius,radius+.001,.20)
                    candidates=[(float(dx),float(dz))for dx in steps for dz in steps if dx*dx+dz*dz<=radius*radius+.001]
                    candidates.sort(key=lambda q:(2*q[0]*q[0]+q[1]*q[1],abs(q[0]),abs(q[1]),q[0],q[1]))
                    grid_cache[radius]=candidates
                c,s=math.cos(car['angle']),math.sin(car['angle'])
                for dx,dz in grid_cache[radius]:
                    x=original['x']+c*dx+s*dz;z=original['z']-s*dx+c*dz
                    candidate=clear(x,z)
                    if candidate is not None:result=candidate;chosen=(x,z);break
                if result is not None:break
        if result is None and bay_shape is not None:
            # A source-calibrated bay can be narrower than a generic estimated
            # car. Keep the bay identity, try its measured longitudinal heading.
            a=markings[f'office-bay-boundary-{bay:02d}']['points'];b=markings[f'office-bay-boundary-{bay+1:02d}']['points']
            v=np.array(a[-1])+np.array(b[-1])-np.array(a[0])-np.array(b[0])
            angle=math.atan2(v[0],v[1]);angle+=math.pi if math.cos(angle-original['angle'])<0 else 0
            car['angle']=angle
            centre=bay_shape.centroid
            result=clear(centre.x,centre.y)
            if result is not None:chosen=(centre.x,centre.y)
        if result is None:
            car['angle']=original['angle'];failed.append(car['id']);body_records.append(_body(car));continue
        if chosen is not None:car['x'],car['z']=[round(v,5)for v in chosen]
        body_records.append(result)
        distance=math.hypot(car['x']-original['x'],car['z']-original['z'])
        if distance>.001 or abs(car['angle']-original['angle'])>.001:
            correction={'id':car['id'],'from':original,'to':{k:car[k]for k in ['x','z','angle']},'distance':round(distance,5),
                        'reason':'Keep the observed car inside its painted bay or source-derived asphalt, clear of fixed roads, raised walks and adjacent vehicles.'}
            car['boundedPlacement']=correction;adjustments.append(correction)
    # Keep the conflicted southern row as one rigid group, retaining its source
    # rhythm and headings. This is an explicit source-versus-map reconciliation,
    # not an assertion that these five new positions are observed in the photo.
    group_adjustment=None
    ramp=next((corridors[i]for i,r in enumerate(roads)if r['sourceWayId']==1131102991),None)
    conflict_group=[c for c in out['cars']if c['id'].startswith('parking-central-highway-east')and ramp is not None and _body({**c,**c['sourcePose']}).intersection(ramp).area>.005]
    if conflict_group:
        ids={c['id']for c in conflict_group}
        source_group=unary_union([_body({**c,**c['sourcePose']})for c in conflict_group])
        others=prep(unary_union([_body(c).buffer(.076)for c in out['cars']if c['id']not in ids]))
        available_prepared=prep(available)
        vectors=[(float(x),float(z))for x in np.arange(-8,8.001,.20)for z in np.arange(-8,8.001,.20)if x*x+z*z<=64.001]
        vectors.sort(key=lambda p:(p[0]*p[0]+p[1]*p[1],p[0],p[1]))
        for dx,dz in vectors:
            candidate=translate(source_group,xoff=dx,yoff=dz)
            if not available_prepared.covers(candidate)or others.intersects(candidate):continue
            distance=math.hypot(dx,dz)
            group_adjustment={'ids':sorted(ids),'translation':[round(dx,5),round(dz,5)],'rotationDegrees':0,
                              'distance':round(distance,5),'method':'One rigid translation; original inter-car spacing and headings retained.',
                              'confidence':'Approximate reconciliation required by the fixed OSM connector; these five placements are not 1:1 source matches.'}
            adjustments=[a for a in adjustments if a['id']not in ids]
            for car in conflict_group:
                p=car['sourcePose'];car['x']=round(p['x']+dx,5);car['z']=round(p['z']+dz,5);car['angle']=p['angle']
                record={'id':car['id'],'from':{k:p[k]for k in ['x','z','angle']},'to':{k:car[k]for k in ['x','z','angle']},
                        'distance':round(distance,5),'reason':'Coherent row placement clear of fixed connector1131102991; source spacing and headings retained.'}
                car['boundedPlacement']=record;adjustments.append(record)
            break
    actual_bodies=[_body(car)for car in out['cars']]
    remaining_road=sum(p.intersection(road_surface).area>.001 for p in actual_bodies)
    residual=np.linalg.norm(src+fit(src)-dst,axis=1)
    metadata={'type':'parking-only fit between two observed road curbs plus bounded local car placement',
              'sourceObservationCount':len(controls),'smoothing':.25,'controls':controls,'maxControlResidual':float(residual.max()),
              'unchangedRoadAxes':True,'sourceCarCount':len(source['cars']),'retainedCarCount':len(out['cars']),
              'carPlacementSearchRadiusLimit':12,'carPlacementGridStep':.20,'carBodyWidthClearanceFactor':1.10,
              'carAdjustments':adjustments,'maxCarAdjustment':max((c['distance']for c in adjustments),default=0),
              'rigidRampGroup':group_adjustment,
              'sourceFaceSeam':[{'northPoint':project([a],0,'node1-face3')[0],'centralPoint':project([b],0,'node1-face5')[0],
                                 'gap':math.dist(project([a],0,'node1-face3')[0],project([b],0,'node1-face5')[0])}
                                for a,b in [([2950,3500],[0,551]),([2386,3500],[0,1114])]],
              'unresolvedCars':failed,'remainingCarRoadOverlaps':remaining_road,
              'parkingSurfaceRoadOverlapAfter':sum(_shape(a).intersection(road_surface).area for a in out['areas']),
              'sourceFitAreaBeforeClipping':before_area,'areaCountAfterClipping':len(out['areas']),
              'rampRegistrationCaveat':'The source aerial parking and fixed straight OSM connector1131102991 cannot share every unadjusted coordinate. Every local car correction is retained above; source pixels remain unchanged.'}
    out['fitMetadata']=metadata
    return out,metadata

if __name__=='__main__':
    from projection import SCALE
    source=json.loads((QA/'forecourt-road-pixels.json').read_text())
    data=json.loads((QA/'projected-forecourt.json').read_text())['roadside']
    roads=json.loads((QA/'road-data.json').read_text())
    out,meta=refit_roadside(source,data,roads,SCALE)
    (QA/'roadside-bounded-final-preview.json').write_text(json.dumps({'roadside':out},ensure_ascii=False,indent=2)+'\n')
    (QA/'roadside-fit-results.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:meta[k]for k in ['retainedCarCount','maxCarAdjustment','unresolvedCars','remainingCarRoadOverlaps','parkingSurfaceRoadOverlapAfter','areaCountAfterClipping']},indent=2))
