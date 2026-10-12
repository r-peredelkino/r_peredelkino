"""Validate the generated surfaces against the unchanged engineering contours."""
import json,math
from pathlib import Path
from shapely.geometry import Polygon,Point,LineString,box
from shapely.affinity import rotate,scale
from shapely.ops import unary_union
root=Path(__file__).resolve().parents[2]
def get(p):return json.loads((root/p).read_text().split('=',1)[1].strip().rstrip(';'))
f=get('dist/complex-footprints.js');court=get('dist/courtyard-layout.js');street=get('dist/public-realm-layout.js')
blocked=unary_union([Polygon(f[k]['outer'],f[k]['holes']) for k in ['podium','arena','kindergarten']]);site=Polygon(f['site']['outer'])
public_site=Polygon(street['boundary']['outer'],street['boundary']['holes'])
assert public_site.is_valid and public_site.difference(site).area>1500
assert site.difference(public_site).area<1e-5
for data in [court,street]:
 envelope=site if data is court else public_site
 for c in data['islands']:
  poly=Polygon(c['outer'],c['holes']);assert poly.is_valid;assert poly.intersection(blocked.buffer(.5)).area<1e-5;assert poly.difference(envelope).area<1e-5
 for x,z,s in data['trees']:assert Point(x,z).distance(blocked)>2.4
gardens=unary_union([Polygon(c['outer'],c['holes']) for c in street['islands']])
for p in [*[t[:2] for t in street['trees']],*street['matureTrees']]:assert gardens.contains(Point(*p)),'Street trees grow in planted soil'
for c in street['cafes']:
 p=rotate(box(c['x']-3.5,c['z']-2.8,c['x']+3.5,c['z']+2.8),-c['angle']*180/math.pi,origin=(c['x'],c['z']));assert p.intersection(blocked).area<1e-5;assert p.difference(public_site).area<1e-5
for b in street['benches']:
 p=Polygon(b['seat']['outer'],b['seat']['holes']);assert p.is_valid;assert p.intersection(blocked).area<1e-5;assert p.difference(public_site).area<1e-5;assert p.intersection(gardens).area<1e-5
for c in street['pavilions']:
 p=rotate(box(c['x']-c['width']/2-.2,c['z']-c['depth']/2-.2,c['x']+c['width']/2+.2,c['z']+c['depth']/2+.2),-c['angle']*180/math.pi,origin=(c['x'],c['z']));assert p.intersection(blocked).area<1e-5;assert p.difference(public_site).area<1e-5
for l in street['lightLines']:
 p=LineString(l['points']);assert p.distance(blocked)>.4;assert p.difference(public_site).length<1e-5
play=next(z for z in court['zones'] if z['id']=='play');p=scale(Point(play['x'],play['z']).buffer(1,quad_segs=64),play['rx'],play['rz'],origin=(play['x'],play['z']));assert p.area>2*math.pi*12*6;assert p.intersection(blocked.buffer(.7)).area<1e-5
print('PASS: preserved engineering envelope; extended promenade; planted-soil trees; curved seats and shade pavilions outside buildings; cafes in public envelope; all light segments clear; enlarged playhub')
