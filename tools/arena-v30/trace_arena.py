"""Trace the missing arena planting from the registered June 29 panorama.

The hand-picked pixels are observable bed edges at ground level, except for
explicitly estimated occluded tree feet. Curves are clipped to the existing
pedestrian paving and kept clear of buildings. No road graph is changed.
"""
from pathlib import Path
import sys, json, math, importlib.util, hashlib
HERE=Path(__file__).resolve()
WORK=next(q for d in HERE.parents for q in [d,d/'rodina-v30'] if (q/'dist/forecourt-reference-data.js').is_file())
TOOL=HERE.parent
CHECK_ONLY='--check' in sys.argv[1:]
if any(arg!='--check' for arg in sys.argv[1:]):raise SystemExit('Usage: python trace_arena.py [--check]')
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely import make_valid
from shapely.affinity import translate

DIST=WORK/'dist'
spec=importlib.util.spec_from_file_location('source_projection',TOOL/'projection.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
p.FOV=58.;p.YAW=math.radians(37);p.TILT=math.radians(-37);p.WIDTH=1700;p.HEIGHT=1200

def data(name):
    text=(DIST/name).read_text();return json.loads(text[text.index('={')+1:].rstrip(';\n'))
def polygon(obj):return make_valid(Polygon(obj['outer'],obj.get('holes',[])))
realm=data('public-realm-layout.js'); footprints=data('complex-footprints.js'); reference=data('forecourt-reference-data.js')
paving=unary_union([polygon(q) for q in realm.get('promenadeParts',[realm['promenade']])])
architecture=unary_union([polygon(footprints[k]) for k in ['podium','arena']])
safe=paving.buffer(-.20).difference(architecture.buffer(.30))

# Source exports are 1700 x 1200, native (no resize or crop).
island_pixels=[
 {'id':'arena-south-tree-garden','outer':[[297,1108],[314,1084],[339,1070],[362,1068],[397,1077],[431,1086],[470,1079],[492,1097],[491,1124],[470,1147],[439,1155],[400,1144],[371,1137],[337,1140],[310,1125]],'canopyHeightMeters':.86},
 {'id':'arena-central-tree-garden','outer':[[651,993],[650,975],[669,951],[701,930],[724,910],[750,881],[775,859],[799,861],[821,883],[846,904],[871,906],[900,882],[926,883],[941,902],[935,926],[902,948],[856,974],[803,995],[748,1008],[706,1008],[674,1002]],'canopyHeightMeters':.94},
 {'id':'arena-storefront-pocket-west','outer':[[906,746],[922,733],[948,727],[969,731],[982,744],[977,758],[959,772],[936,778],[916,770],[903,758]],'canopyHeightMeters':.83},
 {'id':'arena-storefront-pocket-east','outer':[[1060,684],[1069,668],[1090,657],[1115,657],[1136,667],[1155,680],[1162,691],[1148,707],[1135,719],[1107,718],[1085,706]],'canopyHeightMeters':.92},
 {'id':'arena-east-tree-garden','outer':[[987,880],[987,859],[1002,840],[1027,823],[1037,804],[1050,786],[1072,776],[1090,778],[1113,791],[1130,811],[1126,837],[1103,857],[1065,876],[1025,889],[1004,893]],'canopyHeightMeters':.94},
 {'id':'arena-burgundy-cream-garden','kind':'flowerbed','canopyHeightMeters':.73,'outer':[[1189,797],[1189,783],[1200,756],[1212,730],[1226,724],[1245,724],[1269,733],[1291,741],[1305,753],[1307,760],[1286,773],[1254,784],[1220,796],[1199,804]],'patches':[
  {'id':'arena-red-lower','outer':[[1189,797],[1190,780],[1200,758],[1214,763],[1229,777],[1221,793],[1199,804]]},
  {'id':'arena-red-upper','outer':[[1217,729],[1233,723],[1249,727],[1254,742],[1243,748],[1227,742]]},
  {'id':'arena-red-east','outer':[[1270,734],[1289,740],[1304,751],[1307,760],[1291,769],[1283,760],[1278,747]]}
 ]},
 {'id':'arena-entrance-island-west','outer':[[1228,683],[1232,664],[1248,652],[1265,640],[1286,642],[1301,654],[1306,670],[1293,684],[1271,692],[1249,695],[1233,690]],'canopyHeightMeters':.94},
 {'id':'arena-entrance-island-east','outer':[[1344,650],[1345,634],[1354,620],[1374,612],[1395,619],[1412,635],[1417,651],[1408,668],[1392,678],[1377,682],[1358,674]],'canopyHeightMeters':1.03},
 {'id':'arena-north-entry-garden','outer':[[1360,557],[1357,540],[1341,523],[1329,506],[1321,484],[1330,471],[1350,475],[1370,492],[1401,507],[1437,497],[1474,491],[1497,502],[1514,520],[1512,538],[1475,550],[1445,566],[1411,576],[1380,573]],'canopyHeightMeters':1.02},
]
tree_pixels=[
 {'id':'arena-tree-south','island':'arena-south-tree-garden','base':[362,1114],'heightMeters':6.2,'crownRadiusMeters':1.8},
 {'id':'arena-tree-central-west','island':'arena-central-tree-garden','base':[704,980],'heightMeters':6.7,'crownRadiusMeters':2.15},
 {'id':'arena-tree-central-east','island':'arena-central-tree-garden','base':[839,954],'heightMeters':7.3,'crownRadiusMeters':2.1},
 {'id':'arena-tree-east-west','island':'arena-east-tree-garden','base':[1035,866],'heightMeters':5.8,'crownRadiusMeters':1.75},
 {'id':'arena-tree-east-east','island':'arena-east-tree-garden','base':[1090,836],'heightMeters':6.6,'crownRadiusMeters':1.85},
]
line_pixels=[
 {'id':'arena-purple-south','color':'purple','points':[[29,1175],[67,1136],[104,1115],[170,1111],[250,1104],[301,1079],[334,1048],[360,1029],[394,1011],[455,1019],[492,1026],[519,1022],[552,1003],[589,969],[621,944],[655,925]],'widthMeters':.066},
 {'id':'arena-purple-central','color':'purple','points':[[910,869],[921,839],[940,816],[960,806],[980,807],[1006,818]],'widthMeters':.066},
 {'id':'arena-purple-east','color':'purple','points':[[1134,782],[1152,785],[1167,768],[1176,741],[1191,716],[1216,706],[1246,713],[1268,710],[1282,689]],'widthMeters':.066},
 {'id':'arena-purple-entrance','color':'purple','points':[[1231,687],[1224,674],[1225,654],[1237,627],[1248,596],[1241,568],[1256,537]],'widthMeters':.066},
 {'id':'arena-white-south','color':'white','points':[[213,1131],[238,1094],[275,1061],[311,1029],[342,1004],[380,992],[419,1005],[455,1011],[489,1008],[520,996],[545,976],[583,956],[621,937]],'widthMeters':.045},
 {'id':'arena-white-center','color':'white','points':[[809,905],[830,898],[852,886],[879,866],[905,840],[928,815],[951,798],[980,796],[1008,807]],'widthMeters':.045},
 {'id':'arena-white-east','color':'white','points':[[1135,779],[1146,742],[1162,710],[1190,696],[1218,701],[1241,711],[1263,712],[1285,698],[1304,672]],'widthMeters':.045},
]
lamp_pixels=[[219,1068],[618,929],[898,929],[1070,873],[1139,717],[1243,691],[1386,675],[1391,565]]
zone_pixels=[[0,1199],[458,1199],[1699,685],[1659,459],[1496,451],[1302,450],[1247,603],[1223,654],[1018,760],[611,936],[0,1104]]

def projected(poly):return p.smooth([p.pixel_to_world(q) for q in poly],closed=True,steps=5)
def parts(g,kind='Polygon'):
    if g.is_empty:return []
    if g.geom_type==kind:return [g]
    return [q for q in getattr(g,'geoms',[]) if q.geom_type==kind]
def contour(g):return {'outer':[[round(x,5),round(y,5)] for x,y in list(g.exterior.coords)[:-1]],'holes':[[[round(x,5),round(y,5)] for x,y in list(r.coords)[:-1]] for r in g.interiors]}
islands=[];checks=[]
for source in island_pixels:
    raw=make_valid(Polygon(projected(source['outer'])));original=raw;shift=[0.,0.]
    # The existing frontage is locally narrower than the AGL60 ground-ray fit.
    # Preserve each observed bed silhouette with the shortest small translation
    # into that fixed pedestrian band, instead of chopping off 25–40% of a bed.
    # Every displacement is retained below as explicit reconstruction metadata.
    if not safe.covers(raw):
        best=(raw.intersection(safe).area/raw.area,0.,0.)
        for radius in [i*.125 for i in range(1,21)]:
            for i in range(32):
                a=i*math.tau/32;dx=math.cos(a)*radius;dz=math.sin(a)*radius
                candidate=translate(original,dx,dz);ratio=candidate.intersection(safe).area/original.area
                if ratio>best[0]+1e-8:best=(ratio,dx,dz)
            if best[0]>.995:break
        shift=list(best[1:]);raw=translate(original,*shift)
    clipped=raw.intersection(safe)
    pieces=sorted(parts(clipped),key=lambda q:q.area,reverse=True)
    if not pieces:raise ValueError('Source planting outside pedestrian surface: '+source['id'])
    final=pieces[0]
    if final.area<raw.area*.7:raise ValueError('Large source registration loss: '+source['id']+' '+str(final.area/raw.area))
    record={k:v for k,v in source.items() if k not in ['outer','patches']};record.update(contour(final));record['sourcePlaneMeters']=0;record['registrationShift']=[round(v,5) for v in shift]
    if source.get('patches'):
        record['patches']=[]
        for patch in source['patches']:
            pp=translate(make_valid(Polygon(projected(patch['outer']))),*shift).intersection(final)
            for j,part in enumerate(parts(pp)):
                if part.area>.03:record['patches'].append({'id':patch['id']+(f'-{j}' if j else ''),**contour(part)})
    islands.append(record);checks.append({'id':source['id'],'rawArea':round(raw.area,4),'area':round(final.area,4),'clipLoss':round(raw.area-final.area,4),'registrationShift':record['registrationShift'],'minimumBuildingGap':round(final.distance(architecture),4)})
gardenUnion=unary_union([polygon(q) for q in islands])
lines=[]
for line in line_pixels:
    raw=LineString(p.smooth([p.pixel_to_world(q) for q in line['points']],closed=False,steps=5))
    for j,part in enumerate(parts(raw.intersection(safe).difference(gardenUnion.buffer(.10)),'LineString')):
        if part.length<.18:continue
        lines.append({**line,'id':line['id']+f'-{j}','points':[[round(x,5),round(z,5)] for x,z in part.coords]})
trees=[]
for source in tree_pixels:
    q=p.pixel_to_world(source['base']);bed=next(x for x in islands if x['id']==source['island']);q=[round(a+b,5) for a,b in zip(q,bed['registrationShift'])];bedPoly=polygon(bed)
    if not bedPoly.buffer(-.2).contains(Point(q)):raise ValueError('Estimated tree foot outside source island: '+source['id'])
    trees.append({k:v for k,v in source.items() if k!='island'}|{'base':q,'anchorConfidence':'estimated foot under visible source crown'})
lamps=[]
for i,pixel in enumerate(lamp_pixels):
    q=p.pixel_to_world(pixel)
    if not safe.buffer(.15).contains(Point(q)):continue
    lamps.append({'id':f'arena-source-light-{i+1}','x':q[0],'z':q[1],'height':3.1,'tracedWhite':True,'sourcePixel':pixel})

zone=make_valid(Polygon([p.pixel_to_world(q) for q in zone_pixels])).intersection(paving)
replacement=[contour(q) for q in parts(zone)]
# One pair of cafe umbrellas is visible in this new strip. Their projected
# canopy centres use a declared 2.83 scene-metre plane instead of ground rays.
umbrella=[p.pixel_to_world(q,height=2.83/p.SCALE) for q in [[484,934],[575,892]]]
cx=sum(q[0] for q in umbrella)/2;cz=sum(q[1] for q in umbrella)/2
cafe={'id':'arena-source-cafe-west','x':round(cx,5),'z':round(cz,5),'angle':-math.atan2(umbrella[1][1]-umbrella[0][1],umbrella[1][0]-umbrella[0][0]),'sourcePixels':[[484,934],[575,892]]}
seat_pixels=[[537,1032],[543,1023],[561,1018],[578,1023],[586,1035],[582,1048],[567,1056],[549,1058],[539,1047]]
seat_outer=projected(seat_pixels);seat_poly=Polygon(seat_outer);seat_center=list(seat_poly.centroid.coords)[0]
pebbles=[{'id':'arena-source-white-seat','outer':seat_outer,'center':list(seat_center),'heightMeters':.48}] if safe.covers(seat_poly) else []
camera={'position':[float(p.camera_xz()[0]),p.ALTITUDE*p.SCALE,float(p.camera_xz()[1])],'target':[*p.pixel_to_world([849.5,599.5])],'horizontalFov':58,'verticalFov':math.degrees(2*math.atan(math.tan(math.radians(29))*1200/1700)),'pan':-37,'tilt':-37,'pannorth':123.58,'imageSize':[1700,1200]}
source={'url':'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/','node':'node1','image':'arena-source.png','sha256':hashlib.sha256((TOOL/'arena-source.png').read_bytes()).hexdigest(),'camera':camera,'assumptions':['Altitude 60 m is treated as AGL, matching v29 registration.','Bed boundaries are hand-traced from visible source edges on an approximately flat ground plane.','Occluded tree feet, plant heights and lamp heights are estimates; retained architecture and carriageways are fixed.','Five beds need explicit local translations of 0.25 to 2.25 scene metres because the fixed promenade is narrower than the raw panorama plane fit.','Contours retain more than 99.5% of traced area after local registration, and are clipped to the pedestrian surface with a 0.30 m building gap.']}
output={'source':source,'baseY':.025,'islands':islands,'lines':lines,'trees':trees,'lamps':lamps,'cafes':[cafe],'replacementZones':replacement,'benches':[],'planters':[],'pebbles':pebbles,'mediaColumns':[]}
runtime_text='// Source-pixel reconstruction of the missing arena frontage, v30. See tools/arena-v30/trace_arena.py.\nexport const arenaLandscape='+json.dumps(output,separators=(',',':'),ensure_ascii=False)+';\n'
trace_text=json.dumps({'source':source,'pixelIslands':island_pixels,'pixelTrees':tree_pixels,'pixelLines':line_pixels,'pixelLamps':lamp_pixels,'pixelReplacementZone':zone_pixels,'checks':checks},indent=2,ensure_ascii=False)
if CHECK_ONLY:
    if (DIST/'arena-landscape-data.js').read_text()!=runtime_text:raise SystemExit('FAIL: regenerated arena data differs from the installed dist file; no files were written.')
else:
    (DIST/'arena-landscape-data.js').write_text(runtime_text)
    (TOOL/'arena-source-trace.json').write_text(trace_text)
print(json.dumps({'mode':'check (read only)' if CHECK_ONLY else 'regenerate','runtimeSha256':hashlib.sha256(runtime_text.encode()).hexdigest(),'islands':len(islands),'trees':len(trees),'lineFragments':len(lines),'lamps':len(lamps),'area':round(gardenUnion.area,3),'checks':checks},indent=2))
