"""@r_peredelkino: reference-led courtyard and street landscape clipped to engineering footprints.
Refs supplied 2026-10-08: 1345.webp, 234234.webp, 432234.jpeg, 345234.jpeg,
123.webp (overhead playhub), 124543.jpg (retail street), 1234.webp, 123.jpg.
Reconstruction of visible motifs; render images do not provide a surveyed planting plan.
"""
import json, random, math
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import scale, rotate
from shapely.ops import unary_union
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/complex-footprints.js').read_text().split('=',1)[1].strip().rstrip(';'))
routes=json.loads((root/'tools/courtyard-routes.json').read_text())
site=Polygon(data['site']['outer']);podium=Polygon(data['podium']['outer'],data['podium']['holes']);kids=Polygon(data['kindergarten']['outer']);arena=Polygon(data['arena']['outer'])
blocked=unary_union([podium,kids,arena]);free=site.buffer(-.6).difference(blocked.buffer(.85));court_box=box(-44,-59,53,59)
paths=unary_union([LineString(p).buffer(1.65) for p in routes])
zones=[{'id':'lounge','x':-23,'z':-5,'rx':7,'rz':6},{'id':'sport','x':-2,'z':-37,'rx':9,'rz':4},{'id':'play','x':20,'z':36,'rx':17.5,'rz':8.5},{'id':'events','x':27,'z':-39,'rx':5,'rz':4},{'id':'fountain','x':-14,'z':-10,'rx':2.4,'rz':1.8}]
def ellipse(x,z,rx,rz):return scale(Point(x,z).buffer(1,quad_segs=32),rx,rz,origin=(x,z))
zone_shapes=[ellipse(z['x'],z['z'],z['rx'],z['rz']) for z in zones]
for z,shape in zip(zones,zone_shapes):assert shape.intersection(blocked.buffer(.7)).area<.01,(z['id'],'building overlap')
# Cafe terraces stay outside the courtyard and leave the existing pedestrian routes open.
cafes=[];boundary=podium.exterior
for at in range(15,int(boundary.length),28):
 p=boundary.interpolate(at);q=boundary.interpolate(at+.25);dx=q.x-p.x;dz=q.y-p.y;n=math.hypot(dx,dz)
 for sign in [-1,1]:
  x=p.x+sign*dz/n*5.2;z=p.y-sign*dx/n*5.2;area=ellipse(x,z,3.2,2.6)
  if court_box.contains(Point(x,z)) or area.intersection(blocked.buffer(1)).area>.01 or area.difference(site.buffer(-.5)).area>.01 or area.intersection(paths).area>.1 or Point(x,z).distance(arena)<5:continue
  if all(math.hypot(x-c['x'],z-c['z'])>16 for c in cafes):cafes.append({'x':round(x,3),'z':round(z,3),'angle':round(-math.atan2(dz,dx),5)})
  break
reserved=unary_union(zone_shapes+[ellipse(c['x'],c['z'],3.8,3.3) for c in cafes]).buffer(1.0)
rng=random.Random(2711);islands=[]
for i in range(76):
 x=rng.uniform(-40,48);z=rng.uniform(-53,55)
 islands.append(rotate(ellipse(x,z,rng.uniform(4,11),rng.uniform(2.5,5.8)),rng.uniform(-90,90),origin=(x,z)))
court=unary_union(islands).intersection(free).intersection(court_box).difference(paths).difference(reserved)
# Long planted islands in the retail promenade rather than trees scattered on paving.
outer_candidates=[]
for i in range(130):
 x=rng.uniform(-115,118);z=rng.uniform(-125,115)
 if court_box.contains(Point(x,z)):continue
 outer_candidates.append(rotate(ellipse(x,z,rng.uniform(3,10),rng.uniform(1.8,4.5)),rng.uniform(-90,90),origin=(x,z)))
street=unary_union(outer_candidates).intersection(free).difference(court_box).difference(paths).difference(reserved)
def parts(geometry):return [p for p in (geometry.geoms if hasattr(geometry,'geoms') else [geometry]) if p.area>10]
court_parts=parts(court);street_parts=parts(street);court=unary_union(court_parts);street=unary_union(street_parts)
def plant(garden,bounds,seed,tree_max,shrub_max,flower_max):
 r=random.Random(seed);trees=[];shrubs=[];flowers=[]
 for _ in range(95000):
  x=r.uniform(bounds[0],bounds[2]);z=r.uniform(bounds[1],bounds[3]);p=Point(x,z)
  if not garden.contains(p):continue
  if len(trees)<tree_max and p.distance(garden.boundary)>1.45 and p.distance(blocked)>2.5 and all(math.hypot(x-a[0],z-a[1])>3.6 for a in trees):trees.append([round(x,3),round(z,3),round(r.uniform(.95,1.65),3)])
  if len(shrubs)<shrub_max:shrubs.append([round(x,3),round(z,3),round(r.uniform(.45,1.05),3)])
  if len(flowers)<flower_max and p.distance(garden.boundary)<1.1:flowers.append([round(x,3),round(z,3),r.randrange(4)])
 return trees,shrubs,flowers
ct,cs,cf=plant(court,(-44,-59,53,59),2711,160,3500,2900)
st,ss,sf=plant(street,(-116,-126,119,117),6517,230,3000,2200)
lamps=[]
for points in routes:
 line=LineString(points)
 for at in range(8,int(line.length)-5,11):
  a=line.interpolate(at);b=line.interpolate(at+.5);dx=b.x-a.x;dz=b.y-a.y;length=math.hypot(dx,dz)
  if not length:continue
  for sign in [1,-1]:
   x=a.x-sign*dz/length*2.1;z=a.y+sign*dx/length*2.1
   if free.contains(Point(x,z)) and all(math.hypot(x-p[0],z-p[1])>7 for p in lamps):lamps.append([round(x,3),round(z,3)]);break
# Multiple flowing, zigzagging inlays follow all three existing pedestrian routes.
light_lines=[];garden_all=unary_union([court,street]);light_free=site.buffer(-.3).difference(blocked.buffer(.4)).difference(garden_all.buffer(.12))
for route_id,points in enumerate(routes):
 line=LineString(points)
 for channel,color in enumerate(['pink','warm','cyan']):
  segment=[]
  for i in range(int(line.length/.55)+1):
   at=min(line.length,i*.55);a=line.interpolate(at);b=line.interpolate(min(line.length,at+.2));dx=b.x-a.x;dz=b.y-a.y;length=math.hypot(dx,dz)
   if not length:continue
   offset=(-.7+channel*.7)+.36*math.sin(at/5.8+channel*1.4);x=a.x-dz/length*offset;z=a.y+dx/length*offset
   if light_free.contains(Point(x,z)):segment.append([round(x,3),round(z,3)])
   else:
    if len(segment)>5:light_lines.append({'color':color,'points':segment,'route':route_id})
    segment=[]
  if len(segment)>5:light_lines.append({'color':color,'points':segment,'route':route_id})
def contours(polys):return [{'outer':list(p.exterior.coords),'holes':[list(r.coords) for r in p.interiors]} for p in polys]
out={'lamps':lamps,'zones':zones,'islands':contours(court_parts),'trees':ct,'shrubs':cs,'flowers':cf}
public={'islands':contours(street_parts),'trees':st,'shrubs':ss,'flowers':sf,'cafes':cafes,'lightLines':light_lines,'referenceDate':'2026-10-08','playArea':round(zone_shapes[2].area,2)}
(root/'dist/courtyard-layout.js').write_text('export const courtyardLayout='+json.dumps(out,separators=(',',':'))+';\n')
(root/'dist/public-realm-layout.js').write_text('// @r_peredelkino · reference-based landscape, not a surveyed plan.\nexport const publicRealmLayout='+json.dumps(public,separators=(',',':'))+';\n')
print(json.dumps({'courtyardIslands':len(court_parts),'courtyardTrees':len(ct),'streetIslands':len(street_parts),'streetTrees':len(st),'cafes':len(cafes),'lightLines':len(light_lines),'playArea':public['playArea']}))

# The newer aerial reference supersedes the provisional street garden layout.
import runpy
runpy.run_path(str(root/'tools/build-promenade.py'))
