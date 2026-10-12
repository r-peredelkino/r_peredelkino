"""Trace the supplied engineering photograph into the shared client model.
Only the uniform world scale is estimated; no independent building repositioning.
Requires shapely; output is standalone JS without runtime dependencies.
"""
import json, math
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union, nearest_points
from shapely import affinity
from pathlib import Path
j=json.loads(Path('tools/engineering-layout.json').read_text());ox,oz=j['origin'];scale=j['scale']
def world(p):return [(p[0]-ox)*scale,(p[1]-oz)*scale]
def rounded(points,a,steps=12):
 out=[];n=len(points)
 for i,v in enumerate(points):
  prev=points[(i-1)%n];nxt=points[(i+1)%n];start=[v[k]+(prev[k]-v[k])*a for k in range(2)];end=[v[k]+(nxt[k]-v[k])*a for k in range(2)]
  out.append(start)
  for step in range(1,steps+1):
   t=step/steps;u=1-t;out.append([u*u*start[k]+2*u*t*v[k]+t*t*end[k] for k in range(2)])
 return out
polys={};specs=[]
for b in j['buildings']:
 c=[sum(p[k] for p in b['vertices'])/len(b['vertices']) for k in range(2)];cx,cz=world(c);pts=[world(p) for p in rounded(b['vertices'],.19 if b['id'] else .28,48 if b['id'] else 32)];p=Polygon(pts).buffer(0);polys[b['id']]=p
 specs.append({'id':b['id'],'x':round(cx,4),'z':round(cz,4),'h':b['height'],'floors':b['floors'],'r':round(max(math.hypot(x-cx,z-cz) for x,z in pts),4),'angle':0,'shape':[[round(x-cx,4),round(z-cz,4)] for x,z in pts],'photoCenter':c})
cx,cz=world(j['arena']['center']);rx,rz=[v*scale for v in j['arena']['radii']];arena=affinity.scale(Point(cx,cz).buffer(1,quad_segs=48),rx,rz,origin=(cx,cz))
# Vector trace of the outside commercial edge and the inside courtyard edge.
# The photo's coloured annotations are not geometry; never threshold them into walls.
traced=Polygon([world(p) for p in rounded(j['podiumOutline'],.045)]).buffer(0)
base=unary_union([traced,*polys.values(),arena])
assert base.geom_type=='Polygon', 'All buildings must meet the same commercial base'
base=Polygon(base.exterior)
# Smooth ribbon follows the courtyard-facing roof connection traced in the render.
def smooth(points,steps=14):
 out=[]
 for i in range(len(points)-1):
  p0=points[max(i-1,0)];p1=points[i];p2=points[i+1];p3=points[min(i+2,len(points)-1)]
  for n in range(steps):
   t=n/steps
   out.append([.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)])
 return out+[points[-1]]
# The inner roof line is one C-shaped spline through the actual inward rounded tips.
# Tower envelopes have no outward buffer, so the roof border is flush with their facades.
court=Point(*world(j['courtyardCenter']))
anchors=[list(nearest_points(polys[k].boundary,court)[0].coords)[0] for k in range(1,6)]
inner=smooth(anchors,steps=80)
outer=[];width=5.6
for i,(x,z) in enumerate(inner):
 prev=inner[max(0,i-1)];nxt=inner[min(len(inner)-1,i+1)]
 dx=nxt[0]-prev[0];dz=nxt[1]-prev[1];l=math.hypot(dx,dz)
 nx,nz=dz/l,-dx/l
 if nx*(x-court.x)+nz*(z-court.y)<0:nx,nz=-nx,-nz
 outer.append((x+nx*width,z+nz*width))
ribbon=Polygon(inner+outer[::-1]).buffer(0)
roof=unary_union([polys[k] for k in range(1,6)]+[ribbon]).buffer(0)
roof=roof.buffer(.8,quad_segs=12).buffer(-.8,quad_segs=12)
void=Polygon(inner+[(court.x+150,court.y)]).buffer(0)
roof=roof.difference(void)
roof=roof.difference(unary_union([affinity.scale(p,.83,.83,origin=(next(s for s in specs if s['id']==k)['x'],next(s for s in specs if s['id']==k)['z'])) for k,p in polys.items() if k]))
kids=LineString(smooth([world(p) for p in j['kindergarten']['spine']])).buffer(j['kindergarten']['width']*scale/2,quad_segs=16)
assert base.geom_type=='Polygon' and roof.geom_type=='Polygon' and len(roof.interiors)==5
assert base.intersection(arena).area/arena.area>.999
for k,p in polys.items():
 assert base.intersection(p).area/p.area>.999
 if k:assert roof.intersection(p).area>10
assert not roof.intersects(polys[0])
def pack(p):return {'outer':[[round(x,4),round(z,4)] for x,z in p.exterior.coords],'holes':[[[round(x,4),round(z,4)] for x,z in h.coords] for h in p.interiors]}
routes=[{'closed':r['closed'],'points':[world(p) for p in r['points']]} for r in j['walkRoutes']]
# Keep source measurements and client geometry together.
data={'views':j['views'],'source':j['source'],'transform':{'origin':j['origin'],'scale':scale},'buildings':specs,'fan':{**pack(roof),'innerLine':inner,'width':width,'roundingSegments':48},'podium':pack(base),'terrace':pack(base),'arena':pack(arena),'arenaCenter':[cx,cz],'kindergarten':pack(kids),'walkRoutes':routes,'courtyardCenter':world(j['courtyardCenter']),'roadLine':[world(p) for p in j['roadLine']],'site':pack(Polygon([world(p) for p in rounded(j['siteOutline'],.045)]))}
data['attribution']=j['attribution']
# Furnished second-floor terraces follow the real curved facade and stay on the podium.
# This is reference reconstruction, not a claim about private apartment boundaries.
terraces=[]
for spec in specs:
 if not spec['id']:continue
 tower=polys[spec['id']]
 available=tower.buffer(5.4,quad_segs=16).difference(tower.buffer(.2)).intersection(base.buffer(-.22)).difference(arena.buffer(.6)).buffer(0)
 for part in (available.geoms if hasattr(available,'geoms') else [available]):
  if not isinstance(part,Polygon) or part.area<20:continue
  furniture=[]
  safe=part.buffer(-1.25)
  if not safe.is_empty:
   for x in range(math.floor(part.bounds[0]),math.ceil(part.bounds[2]),2):
    for z in range(math.floor(part.bounds[1]),math.ceil(part.bounds[3]),2):
     p=Point(x,z)
     if safe.contains(p) and all(p.distance(Point(q['x'],q['z']))>7 for q in furniture):
      nearest=nearest_points(tower.boundary,p)[0];angle=math.atan2(x-nearest.x,z-nearest.y)
      furniture.append({'x':x,'z':z,'angle':angle})
  rails=[];current=[]
  for x,z in part.exterior.coords:
   if tower.distance(Point(x,z))>.7:
    current.append([x,z])
   elif len(current)>1:rails.append(current);current=[]
   else:current=[]
  if len(current)>1:rails.append(current)
  if not safe.is_empty:
   choices=[]
   for x in range(math.floor(part.bounds[0]),math.ceil(part.bounds[2])):
    for z in range(math.floor(part.bounds[1]),math.ceil(part.bounds[3])):
     point=Point(x,z)
     if not safe.contains(point) or any(point.distance(Point(q['x'],q['z']))<2.1 for q in furniture):continue
     sight=LineString([point,court])
     if not any(sight.intersects(p) for p in polys.values()):choices.append(point)
   spawn=min(choices,key=lambda p:p.distance(court)) if choices else safe.representative_point()
   closest=nearest_points(tower.boundary,spawn)[0];dx,dz=spawn.x-closest.x,spawn.y-closest.y;length=math.hypot(dx,dz) or 1
   look=[court.x,court.y] if choices else [spawn.x+dx/length*40,spawn.y+dz/length*40]
   terraces.append({'id':spec['id'],'level':4.44,**pack(part),'rails':rails,'furniture':furniture,'spawn':[spawn.x,spawn.y],'look':look})
data['terraces']=terraces
Path('dist/complex-footprints.js').write_text('// Generated from attached engineering photo by tools/build-engineering-layout.py.\nexport const complexFootprints='+json.dumps(data,separators=(',',':'))+';\n')
Path('/tmp/engineering-qa.json').write_text(json.dumps(data))
print('PASS: traced office + 5 individually oriented tower contours; arena between towers 2/3; unified engineering podium; connected residential roof fan')
