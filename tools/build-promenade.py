"""@r_peredelkino · composed public realm from main.webp, received 2026-10-08.

Ground-level proportions reconstructed from the supplied aerial render. Building
contours/centres stay in the engineering coordinate system. Only external road
spacing is adjusted to accommodate the visibly broad frontage promenade.
"""
import json, math, random, runpy
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import rotate
from shapely.ops import unary_union

root = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((root/name).read_text().split('=',1)[1].strip().rstrip(';'))
f = read('dist/complex-footprints.js')
court = read('dist/courtyard-layout.js')
routes = json.loads((root/'tools/courtyard-routes.json').read_text())
def model(e,n): return [-.69716*e+.71691*n, .71691*e+.69716*n]
def geo(x,z): return [-.69716*x+.71691*z, .71691*x+.69716*z]
def contour(p): return {'outer':list(p.exterior.coords), 'holes':[list(h.coords) for h in p.interiors]}
def pieces(p,minimum=6):
    return [q for q in (p.geoms if hasattr(p,'geoms') else [p]) if isinstance(q,Polygon) and q.area>minimum]
blocked = unary_union([Polygon(f[k]['outer'],f[k]['holes']) for k in ['podium','arena','kindergarten']])
source_site = Polygon(f['site']['outer'])
# The pink engineering selection envelope omitted part of the external forecourt.
# Its building traces are retained; this separate public envelope reaches the curb.
front = Polygon([model(e,n) for e,n in [(-115,-85),(100,-85),(100,-38),(-115,-38)]])
site = source_site.union(front).buffer(0)
free = site.buffer(-.65).difference(blocked.buffer(1))
route_shapes = [LineString(p).buffer(1.8) for p in routes]
forest_route=[model(e,n) for e,n in [(29,108),(18,122),(19,137),(10,150),(-3,156)]]
route_shapes.append(LineString(forest_route).buffer(2.25))
paths = unary_union(route_shapes)
court_box = box(-44,-59,53,59)

cafes=[]
for e,n in [(-97,-66),(-82,-73),(-57,-73),(-32,-73),(-7,-73),(18,-73),(43,-73),(68,-73),(86,-48)]:
    x,z=model(e,n);angle=-math.atan2(.71691,-.69716)
    area=rotate(box(x-3.6,z-2.8,x+3.6,z+2.8),-angle*180/math.pi,origin=(x,z))
    if area.intersection(blocked.buffer(1)).area<.01 and area.difference(site.buffer(-.5)).area<.01:
        cafes.append({'x':round(x,3),'z':round(z,3),'angle':angle})
pavilions=[]
for id,e,n,w,d in [('office-plaza',-72,-55,6.5,6.5),('front-lounge',-46,-72,4.8,3.8),('arena-lounge',84,-27,4.8,3.8),('forest-lounge',80,25,6,4.5),('forest-plaza',65,83,7,5.5)]:
    x,z=model(e,n);angle=-math.atan2(.71691,-.69716)
    area=rotate(box(x-w/2-.8,z-d/2-.8,x+w/2+.8,z+d/2+.8),-angle*180/math.pi,origin=(x,z))
    if area.intersection(blocked.buffer(.7)).area<.01 and area.difference(site.buffer(-.2)).area<.01:
        pavilions.append({'id':id,'x':round(x,3),'z':round(z,3),'width':w,'depth':d,'angle':angle})
reserved=unary_union([rotate(box(c['x']-3.7,c['z']-3,c['x']+3.7,c['z']+3),-c['angle']*180/math.pi,origin=(c['x'],c['z'])) for c in cafes]+[rotate(box(c['x']-c['width']/2-1,c['z']-c['depth']/2-1,c['x']+c['width']/2+1,c['z']+c['depth']/2+1),-c['angle']*180/math.pi,origin=(c['x'],c['z'])) for c in pavilions])
fountain=model(-99,-73)
reserved=reserved.union(Point(*fountain).buffer(3.3))

def planted_ribbon(e,n,length,width,angle=0,phase=0):
    """A tapered, sinuous planting island, aligned to the frontage or forest edge."""
    shapes=[]
    for i in range(41):
        t=i/40;u=(t-.5)*length;v=math.sin(t*math.pi*2+phase)*width*.24
        radius=width*(.5+.15*math.sin(t*math.pi))*math.sin(math.pi*t)**.35+.12
        a=angle*math.pi/180;ee=e+u*math.cos(a)-v*math.sin(a);nn=n+u*math.sin(a)+v*math.cos(a)
        shapes.append(Point(*model(ee,nn)).buffer(radius,quad_segs=8))
    return unary_union(shapes).simplify(.13,preserve_topology=True)

specs=[]
# The single low row between frontage seating and the curb is the main compositional axis.
for i,e in enumerate([-57,-43,-29,-15,0,15,30,45,60,75,88]):
    specs.append((f'frontage-{i+1}',e,-80+(i%3)*.65,10+(i%3),2.5+(i%2)*.3,0,i*.7))
# Larger islands wrap the office entrance square; they leave its pavilion and fountain open.
specs += [('office-corner',-104,-79,14,4,24,0),('office-edge-1',-110,-63,11,3.4,80,1),('office-edge-2',-110,-47,10,3.3,88,2),('office-garden-1',-91,-51,10,4.2,35,1),('office-garden-2',-82,-63,9,3.8,-25,2),('office-garden-3',-64,-55,9,3.6,70,1),('office-front',-68,-81,9,3.3,10,0)]
# The promenade continues around the arena then becomes a forest-side garden walk.
specs += [('arena-edge',91,-62,13,3.4,75,1),('arena-garden',85,-7,14,4.8,80,2),('forest-edge-1',84,10,11,4.5,70,0),('forest-edge-2',83,43,19,5,75,1),('forest-edge-3',76,65,14,4.5,95,2),('forest-edge-4',49,99,17,5,150,1),('forest-edge-5',31,120,17,6,115,0),('forest-clearing-1',8,139,22,7,100,1),('forest-clearing-2',-3,151,18,6.5,70,2)]
islands=[]
garden_free=free.difference(paths).difference(reserved).difference(court_box)
for id,e,n,l,w,a,phase in specs:
    candidate=planted_ribbon(e,n,l,w,a,phase).intersection(garden_free)
    for j,p in enumerate(pieces(candidate)):
        islands.append({'id':f'{id}-{j}',**contour(p)})
garden=unary_union([Polygon(c['outer'],c['holes']) for c in islands])
forest=Polygon([model(e,n) for e,n in [(-9,112),(14,102),(56,100),(64,116),(36,160),(-10,164)]]).intersection(garden_free).difference(garden.buffer(.55))
for j,p in enumerate(pieces(forest,20)):
    islands.append({'id':f'forest-mass-{j}',**contour(p)})
garden=unary_union([Polygon(c['outer'],c['holes']) for c in islands])

# Curved seats are fitted to the visible inner edge of each garden, not random furniture.
benches=[]
seat_free=free.difference(garden.buffer(.15)).difference(reserved).difference(paths.buffer(.15))
for island in islands:
    p=Polygon(island['outer'],island['holes']);boundary=p.exterior;choices=[]
    for j in range(36):
        at=boundary.length*j/36;point=boundary.interpolate(at);e,n=geo(point.x,point.y)
        # Frontage seats face the shop windows; forest seats face the walking route.
        score=n if island['id'].startswith('frontage') else -point.distance(LineString(routes[2]))
        choices.append((score,at))
    for _,at in sorted(choices,reverse=True) if not island['id'].startswith('forest-mass') else []:
        length=min(5.2,boundary.length*.28);points=[]
        for j in range(19):
            d=(at-length/2+length*j/18)%boundary.length;a=boundary.interpolate(d);b=boundary.interpolate((d+.08)%boundary.length)
            dx=b.x-a.x;dz=b.y-a.y;norm=math.hypot(dx,dz)
            # Polygon exterior orientation from Shapely can vary; select the outside.
            candidate=[a.x+dz/norm*.5,a.y-dx/norm*.5]
            if p.contains(Point(*candidate)):candidate=[a.x-dz/norm*.5,a.y+dx/norm*.5]
            points.append(candidate)
        line=LineString(points);seat=line.buffer(.34,cap_style='round')
        if seat.difference(seat_free).area<.03 and all(line.distance(LineString(b['points']))>2 for b in benches):
            benches.append({'island':island['id'],'points':points,'seat':contour(seat)})
            break

# Trees are confined to planted soil, including a dense mass towards the forest.
rng=random.Random(1708);trees=[];shrubs=[];flowers=[]
for _ in range(125000):
    x=rng.uniform(site.bounds[0],site.bounds[2]);z=rng.uniform(site.bounds[1],site.bounds[3]);p=Point(x,z)
    if not garden.contains(p):continue
    if p.distance(garden.boundary)>.65 and p.distance(blocked)>2.5 and all(math.hypot(x-t[0],z-t[1])>3.7 for t in trees):
        trees.append([round(x,3),round(z,3),round(rng.uniform(.85,1.4),3)])
    if len(shrubs)<3200:shrubs.append([round(x,3),round(z,3),round(rng.uniform(.45,.9),3)])
    if len(flowers)<1800 and p.distance(garden.boundary)<.65:flowers.append([round(x,3),round(z,3),rng.randrange(4)])
mature=[];regular=[]
for i,t in enumerate(trees):
    if i%5==0 and garden.boundary.distance(Point(*t[:2]))>1.9:mature.append(t[:2])
    else:regular.append(t)

# Woven white, pink and cyan inlays, routed around the actual islands/furniture.
court_garden=unary_union([Polygon(c['outer'],c['holes']) for c in court['islands']])
light_free=site.buffer(-.4).difference(blocked.buffer(.45)).difference(unary_union([garden,court_garden]).buffer(.16)).difference(reserved.buffer(.2)).difference(unary_union([Polygon(b['seat']['outer']) for b in benches]).buffer(.25))
light_lines=[]
lines=[*map(LineString,routes),LineString([model(e,-76+math.sin(e/6)*1.7) for e in range(-108,90)]),LineString([model(88+math.sin(n/11)*2,n) for n in range(-60,60)]),LineString(forest_route)]
for route,line in enumerate(lines):
    for channel,color in enumerate(['pink','warm','cyan']):
        samples=[]
        for i in range(int(line.length/.55)+1):
            at=min(line.length-.001,i*.55);a=line.interpolate(at);b=line.interpolate(min(line.length,at+.08));dx=b.x-a.x;dz=b.y-a.y;length=math.hypot(dx,dz)
            if length<1e-9:continue
            off=(channel-1)*.6+.42*math.sin(at/4.8+channel*1.3)
            samples.append([a.x-dz/length*off,a.y+dx/length*off])
        for segment in getattr(LineString(samples).intersection(light_free),'geoms',[LineString(samples).intersection(light_free)]):
            if isinstance(segment,LineString) and segment.length>3:light_lines.append({'color':color,'points':list(segment.coords),'route':route})
curb=LineString([model(-115,-85),model(97,-85),model(100,-80),model(100,-40)])
lamps=[]
for e,n in [(-111,-71),(-102,-41),(-67,-81),(-51,-67),(-22,-67),(5,-68),(34,-67),(62,-68),(94,-53),(92,-17),(87,17),(86,52),(64,91)]:
    x,z=model(e,n)
    if free.contains(Point(x,z)) and not reserved.contains(Point(x,z)):
        lamps.append({'x':x,'z':z,'y':3.25,'color':0xffdfb1})
fan=Polygon(f['fan']['outer'],f['fan']['holes'])
roof_profile=pieces(unary_union([fan.buffer(-d).difference(fan.buffer(-d-.11)) for d in [.65,1.1]]),.1)
play=next(z for z in court['zones'] if z['id']=='play')
out={'boundary':contour(site),'promenade':contour(site.difference(blocked)), 'islands':islands,'trees':regular,'matureTrees':mature,'shrubs':shrubs,'flowers':flowers,'cafes':cafes,'benches':benches,'pavilions':pavilions,'curb':list(curb.coords),'lamps':lamps,'fountain':fountain,'forestRoute':forest_route,'roofProfile':[contour(p) for p in roof_profile],'lightLines':light_lines,'referenceDate':'2026-10-08','reference':'main.webp','playArea':round(math.pi*play['rx']*play['rz'],2)}
out=runpy.run_path(str(root/'tools/refine-promenade-frontage.py'))['refine_frontage'](out,f)
(root/'dist/public-realm-layout.js').write_text('// @r_peredelkino · authored frontage from supplied renders, dimensions reconstructed.\nexport const publicRealmLayout='+json.dumps(out,separators=(',',':'))+';\n')
print(json.dumps({'islands':len(islands),'trees':len(regular),'matureTrees':len(mature),'benches':len(benches),'cafes':len(cafes),'pavilions':len(pavilions),'lightLines':len(light_lines),'gardenArea':round(garden.area)}))
