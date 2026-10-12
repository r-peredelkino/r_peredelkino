// @r_peredelkino · RP-CONCEPT-2026-10-07 · authored underground parking section.
// Colours and services follow the supplied 13.webp and the official brochure p45.
// This demonstrator is NOT the surveyed garage, a capacity claim or an entry-ramp plan.
import * as T from './vendor/three.module.js';
import {createWalkWorld} from './walk-physics.js';
import {embedPixelSignature,stampGeometry} from './baked-authorship.js?v=community38';

const SOURCE_URL='https://rodina-peredelkino.ru/project/web/assets/rodina_peredelkino.pdf';
const ATTR={handle:'@r_peredelkino',modelId:'RP-CONCEPT-2026-10-07',revision:36};
const UP=new T.Vector3(0,1,0);
const RING=[[-13,-12],[13,-12],[13,12],[-13,12]];
function merge(parts){
 const out=new T.BufferGeometry(),plain=parts.map(g=>g.index?g.toNonIndexed():g);
 for(const [name,size] of [['position',3],['normal',3],['uv',2]]){const array=new Float32Array(plain.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;for(const g of plain){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}out.setAttribute(name,new T.BufferAttribute(array,size));}
 plain.forEach((g,i)=>{if(g!==parts[i])g.dispose();parts[i].dispose();});out.computeBoundingBox();out.computeBoundingSphere();return out;
}
function rectangle(x,z,w,d){return{outer:[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],holes:[]};}

/** Local-coordinate section. Floor y=0; semantic level −1 is deliberately not a site elevation. */
export function createParkingShowroom({root=null,building=1,ownedGeometries:externalGeometry=null,ownedMaterials:externalMaterials=null,ownedTextures:externalTextures=null,makeLabel=null}={}){
 const group=new T.Group();group.name='Parking −1 · source-inspired illustrative section';root?.add(group);
 const geos=new Set(),materials=new Set(),textures=new Set(),obstacles=[],solids=[],pois=[],bays=[],ceilings=[],staticMeshes=[];
 let dead=false,time=0,lastTime=0;
 const states={barrier:false,charging:false,storage:false,'find-car':false,info:false,chargingSeconds:0,chargingProgress:0,barrierAngle:0,storageAngle:0};
 const ownGeo=g=>{geos.add(g);externalGeometry?.add(g);return g;},ownMat=m=>{materials.add(m);externalMaterials?.add(m);return m;},ownTexture=t=>{textures.add(t);externalTextures?.add(t);return t;};
 function finish(kind){const size=128,rgba=new Uint8Array(size*size*4);let seed=36013;for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296,v=kind==='concrete'?220+n*25+(x%32===0?5:0):kind==='metal'?243+n*8:kind==='rubber'?214+n*34:238+n*13;rgba.set([v,v,v,255],(y*size+x)*4);}embedPixelSignature(rgba,{label:'parking36/'+kind});const t=ownTexture(new T.DataTexture(rgba,size,size,T.RGBAFormat));t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='concrete'?6:2,kind==='concrete'?6:2);t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.name='Authored parking finish · '+kind;t.userData.attribution={...ATTR};t.userData.pixelProvenance={encodedPixels:true,rgbBits:1};t.needsUpdate=true;return t;}
 const concrete=finish('concrete'),metal=finish('metal'),rubber=finish('rubber');
 function mat(color,roughness=.8,metalness=0,map=concrete){const m=ownMat(new T.MeshStandardMaterial({color,roughness,metalness,map}));m.userData.attribution={...ATTR};m.userData.bakedAuthorship={version:13,label:'parking36',channels:['pixel-rgb','geometry-rpAuthor']};return m;}
 const m={floor:mat(0x77776e,.96),wall:mat(0xb4b3a4,.98),ceiling:mat(0x666354,.92),steel:mat(0x6e7579,.42,.72,metal),dark:mat(0x262d35,.75,.2,metal),rubber:mat(0x181e25,.95,0,rubber),line:mat(0xd9d7c5,.85),blue:mat(0x296d9d,.83),gold:mat(0xa88f4b,.7),purple:mat(0x726d91,.82),red:mat(0xb0604b,.6),carWhite:mat(0xc8cdc7,.28,.38,metal),carBlue:mat(0x435b69,.3,.48,metal),carBronze:mat(0x847968,.33,.4,metal),glass:mat(0x354654,.18,.66,metal)};
 const lightMat=(color)=>{const a=ownMat(new T.MeshBasicMaterial({color,map:metal,toneMapped:false}));a.userData.attribution={...ATTR};a.userData.bakedAuthorship={version:13,label:'parking36-light',channels:['pixel-rgb','geometry-rpAuthor']};return a;};
 const whiteLight=lightMat(0xf2eacd),blueLight=lightMat(0x58b3dc),chargeLight=lightMat(0x78d6b0),purpleLight=lightMat(0x9277cf);
 function mesh(geometry,material,name,parent=group,dynamic=false){const o=new T.Mesh(ownGeo(geometry),material);o.name=name;o.castShadow=o.receiveShadow=true;o.userData.parkingStatic=!dynamic;parent.add(o);if(!dynamic)staticMeshes.push(o);return o;}
 function box(w,h,d,x,y,z,material,name,parent=group,dynamic=false){const o=mesh(new T.BoxGeometry(w,h,d),material,name,parent,dynamic);o.position.set(x,y+h/2,z);return o;}
 function tube(a,b,r,material,name,parent=group,dynamic=false){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=mesh(new T.CylinderGeometry(r,r,start.distanceTo(end),8),material,name,parent,dynamic);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(UP,end.sub(start).normalize());return o;}
 function label(text,w,h,x,y,z,yaw=0){if(!makeLabel)return null;const o=makeLabel(text,w,h,x,y,z);group.add(o);o.position.set(x,y,z);o.rotation.y=yaw;o.userData.parkingLabel=true;return o;}
 function collider(id,x,z,w,d,angle=0){const o={type:'box',id,x,z,width:w,depth:d,angle};obstacles.push(o);return o;}
 const boundary={outer:RING.map(p=>[...p]),holes:[]};
 box(26,.14,24,0,-.14,0,m.floor,'Textured parking floor with source-inspired circulation');
 for(const x of [-13,13])box(.18,3.25,24,x,0,0,m.wall,'Parking perimeter concrete wall');
 box(26,3.25,.18,0,0,-12,m.wall,'Parking south concrete wall');box(26,3.25,.18,0,0,12,m.wall,'Parking north concrete wall');
 const ceiling=box(26,.12,24,0,3.25,0,m.ceiling,'Parking exposed service ceiling',group,true);ceilings.push(ceiling);
 // Two 7-bay rows: example bays, never the complex's capacity or original bay assignment.
 for(const side of [-1,1])for(let i=0;i<7;i++){
  const x=(i-3)*2.7,z=side*5.5,number=(side<0?111:211)+i,bay={id:'bay-'+number,number,x,z,width:2.5,depth:5,illustrative:true};bays.push(bay);
  for(const edge of [-1,1])box(.035,.009,5,x+edge*1.25,.006,z,m.line,'Parking bay white longitudinal line');
  box(2.5,.009,.035,x,.006,z-side*2.5,m.line,'Parking bay white stop line');
  box(1.6,.085,.11,x,.01,z+side*1.88,m.dark,'Parking wheel stop');
  label(String(number)+' / ДЕМО',1.6,.22,x,.021,z-side*2.3,Math.PI/2); // floor-facing labels are rotated below
  const text=group.children[group.children.length-1];if(text?.userData.parkingLabel){text.rotation.set(-Math.PI/2,0,side<0?0:Math.PI);}
 }
 // Low polygon cars use sculpted body silhouettes, glazed cabins, wheels and lamps.
 function car(bay,index){
  const carGroup=new T.Group();carGroup.name='Parking authored low-poly car '+bay.number;carGroup.position.set(bay.x,0,bay.z);carGroup.rotation.y=bay.z<0?0:Math.PI;group.add(carGroup);
  const paint=[m.carWhite,m.carBlue,m.carBronze][index%3],length=index%4===0?4.35:4.08,width=1.82;
  const body=new T.Shape([new T.Vector2(-length/2,.32),new T.Vector2(-length/2+.16,.64),new T.Vector2(-.9,.75),new T.Vector2(.96,.75),new T.Vector2(length/2-.14,.61),new T.Vector2(length/2,.38),new T.Vector2(length/2-.05,.28),new T.Vector2(-length/2+.05,.28)]);
  const bodyGeo=new T.ExtrudeGeometry(body,{depth:width,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.08,bevelThickness:.055});bodyGeo.rotateY(Math.PI/2);bodyGeo.translate(-width/2,0,0);mesh(bodyGeo,paint,'Sculpted authored car body',carGroup);
  const cabin=new T.Shape([new T.Vector2(-1.13,.76),new T.Vector2(-.62,1.35),new T.Vector2(.54,1.39),new T.Vector2(1.12,.79)]),g=new T.ExtrudeGeometry(cabin,{depth:1.57,bevelEnabled:false});g.rotateY(Math.PI/2);g.translate(-.785,0,0);mesh(g,m.glass,'Angled dark glazed car cabin',carGroup);
  box(1.56,.075,1.16,0,1.39,0,paint,'Car roof cap',carGroup);box(1.64,.14,.24,0,.62,-1.94,paint,'Car sculpted hood lip',carGroup);box(1.3,.11,.04,0,.43,-2.02,m.dark,'Car front grille',carGroup);
  for(const x of [-.91,.91])for(const z of [-1.32,1.34]){const wheel=mesh(new T.CylinderGeometry(.31,.31,.19,12),m.rubber,'Car tire with true cylindrical silhouette',carGroup);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.33,z);const rim=mesh(new T.CylinderGeometry(.19,.19,.195,8),m.steel,'Car alloy wheel',carGroup);rim.rotation.z=Math.PI/2;rim.position.copy(wheel.position);}
  for(const x of [-.62,.62]){box(.36,.105,.035,x,.65,-2.04,whiteLight,'Car front headlight',carGroup);box(.34,.105,.035,x,.65,2.035,m.red,'Car rear lamp',carGroup);box(.12,.075,.2,x/.62*.99,1.04,-.6,paint,'Car side mirror',carGroup);}
  collider('car-'+bay.number,bay.x,bay.z,1.99,length+.2);return{bay:bay.number,position:[bay.x,bay.z],width:1.99,depth:length+.2,body:'bevelled profile, sloped cabin, cylinders, mirrors, grille and lamps'};
 }
 const parkedCars=bays.filter((_,i)=>![3,5,8,12].includes(i)).map(car);
 // Concrete columns stay outside clear bay envelopes and the wide central vehicle aisle.
 const columns=[];for(const x of [-11.1,11.1])for(const z of [-5.5,5.5]){box(.54,3.25,.54,x,0,z,m.wall,'Source-inspired concrete parking column');box(.58,.32,.58,x,.92,z,z>0?m.purple:m.gold,'Parking gold-purple column identification');collider('column-'+x+'-'+z,x,z,.58,.58);columns.push([x,z]);}
 for(const z of [-2.35,2.35]){box(23,.009,.075,0,.01,z,m.line,'Vehicle aisle edge marking');}
 // Linear drainage channel and actual grating stripes inspired by the supplied render.
 box(24,.012,.16,0,.005,.38,m.dark,'Parking linear drainage channel');for(let i=0;i<130;i++)box(.018,.016,.16,-12+i*24/129,.006,.38,m.steel,'Drainage grating transverse slot');
 for(const x of [-6,4]){box(2,.009,.065,x,.014,0,m.line,'White directional arrow shaft');for(const side of [-1,1]){const arm=box(.7,.009,.065,x+.8,.014,side*.22,m.line,'White vehicle directional arrow head');arm.rotation.y=side*Math.PI/5;}}
 // A blue route denotes a proposed pedestrian route, not the developer's certified safety plan.
 const pedestrianRoute=[[-11.25,-9.35],[10.25,-9.35],[10.25,8.72],[-10.25,8.72],[-10.25,2.1]];
 for(let i=1;i<pedestrianRoute.length;i++){const a=pedestrianRoute[i-1],b=pedestrianRoute[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),o=box(l,.012,1.03,(a[0]+b[0])/2,.011,(a[1]+b[1])/2,m.blue,'Authored blue pedestrian wayfinding route');o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);}
 // Exposed services: batching keeps repeated overhead work inexpensive.
 for(const z of [-9,-2.1,2.1,9]){tube([-12,2.96,z],[12,2.96,z],.07,m.steel,'Parking suspended longitudinal services pipe');tube([-12,3.13,z+.3],[12,3.13,z+.3],.022,m.gold,'Parking thin cable conduit');for(const x of [-10,-5,0,5,10])tube([x,2.93,z],[x,3.25,z],.018,m.dark,'Service pipe hanger');}
 for(const x of [-9,0,9]){box(.55,.28,22,x,2.9,0,m.steel,'Parking galvanized ventilation trunk');for(const z of [-8,-4,0,4,8]){box(.48,.025,.44,x,2.865,z,m.dark,'Parking ventilation louver grille');for(let j=0;j<6;j++)box(.018,.028,.42,x-.18+j*.072,2.861,z,m.steel,'Ventilation grille slat');}}
 for(const z of [-8.5,-1.5,7.9])for(const x of [-8,-3,2,7]){box(3.25,.05,.12,x,2.72,z,m.dark,'Suspended LED linear carrier');box(3.05,.012,.052,x,2.709,z,z>0?purpleLight:whiteLight,'Parking suspended luminous strip');for(const side of [-1,1])tube([x+side*1.4,2.75,z],[x+side*1.4,3.25,z],.009,m.dark,'Suspended LED tether');}
 // Gold and purple zone lighting is an aesthetic reconstruction from render13.
 const lights=[];for(const [x,z,color] of [[-7,-6,0xffd99a],[7,-5,0xf7e2b5],[7,6,0xb39de1],[-7,6,0xa8b9d6]]){const light=new T.PointLight(color,10,19,2);light.position.set(x,2.72,z);light.name='Parking source-inspired gold-purple zone light';group.add(light);lights.push(light);}
 // A simple lift portal links back to the caller's selected building entrance.
 box(2.3,2.85,.2,-11.35,0,-11.15,m.dark,'Parking passenger lift portal');for(const x of [-11.88,-10.82])box(1.01,2.4,.08,x,0,-11.02,m.steel,'Parking lift brushed steel door leaf');box(.035,2.4,.1,-11.35,0,-10.97,m.dark,'Parking lift centre joint');box(.25,.36,.09,-9.98,1.12,-11.0,m.dark,'Parking lift call panel');box(.045,.045,.028,-9.98,1.25,-10.94,blueLight,'Parking lift call indicator');
 label('−1  /  ЛИФТ В КОРПУС '+building,3.45,.38,-10.6,2.72,-10.92);
 collider('lift-portal',-11.35,-11.1,2.3,.22);
 // Bicycle and motorcycle demonstration bays are confirmed programme, proposed arrangement.
 function bicycle(x,z,scale=1,motorcycle=false){const parent=new T.Group();parent.name=motorcycle?'Parking authored motorcycle':'Parking authored bicycle';parent.position.set(x,0,z);parent.scale.setScalar(scale);group.add(parent);const radius=motorcycle?.30:.33;for(const p of [-.68,.68]){const wheel=mesh(new T.TorusGeometry(radius,.037,5,12),m.rubber,'Bicycle motorcycle spoked tire',parent);wheel.rotation.y=Math.PI/2;wheel.position.set(0,.35,p);for(let j=0;j<4;j++){const spoke=tube([0,.35-radius*Math.cos(j*Math.PI/4),p-radius*Math.sin(j*Math.PI/4)],[0,.35+radius*Math.cos(j*Math.PI/4),p+radius*Math.sin(j*Math.PI/4)],.009,m.steel,'Cycle wheel spoke',parent);}}
  for(const [a,b] of [[[0,.35,-.68],[0,.78,-.18]],[[0,.78,-.18],[0,.35,.22]],[[0,.35,.22],[0,.35,-.68]],[[0,.78,-.18],[0,.88,.35]],[[0,.88,.35],[0,.35,.22]],[[0,.88,.35],[0,.35,.68]]])tube(a,b,motorcycle?.035:.018,m.steel,'Cycle tubular frame',parent);
  box(.24,.075,.4,0,.86,.3,m.dark,'Cycle saddle',parent);tube([-.27,1.0,-.34],[.27,1.0,-.34],.021,m.steel,'Cycle handlebar',parent);if(motorcycle){box(.36,.3,.45,0,.48,.06,m.dark,'Motorcycle engine casing',parent);box(.34,.22,.53,0,.81,-.07,m.carBlue,'Motorcycle fuel tank',parent);tube([.28,.42,.28],[.28,.35,.85],.037,m.steel,'Motorcycle exhaust',parent);}collider(motorcycle?'motorcycle':'bicycle',x,z,.8,1.9);}
 bicycle(11.35,-6.9,1,false);bicycle(11.35,-4.55,.95,false);bicycle(-11.3,6.7,1.1,true);
 label('ВЕЛО / ДЕМО',2.1,.3,12.75,1.6,-5.7,-Math.PI/2);label('МОТО / ДЕМО',2.1,.3,-12.77,1.6,6.7,Math.PI/2);
 // Storage on −1 is documented. Shapes, count and dimensions below are authored examples.
 const storageRooms=[];let storageDoor=null;
 for(let i=0;i<5;i++){const x=-6+i*3,room=rectangle(x,10.7,2.85,2.4);solids.push(room);storageRooms.push({id:'storage-'+(i+1),...room,illustrative:true});box(2.85,2.5,.10,x,0,11.87,m.wall,'Storage room rear partition');for(const side of [-1,1])box(.10,2.5,2.4,x+side*1.4,0,10.7,m.wall,'Storage room side partition');for(const side of [-1,1])box(.94,2.5,.10,x+side*.97,0,9.5,m.wall,'Storage front portal');box(.97,.32,.10,x,2.18,9.5,m.wall,'Storage door head');
  const pivot=new T.Group();pivot.name=i===0?'Parking demo storage door hinge':'Parking fixed storage door hinge';pivot.position.set(x-.45,0,9.42);group.add(pivot);box(.9,2.12,.055,.45,0,0,m.purple,'Storage door leaf',pivot,i===0);box(.035,.14,.035,.79,.94,-.052,m.steel,'Storage door handle',pivot,i===0);if(i===0)storageDoor=pivot;
  label('КЛАДОВАЯ '+(i+1)+' / ДЕМО',2.1,.24,x,2.69,9.45,Math.PI);
 }
 // Demonstration barrier is inside this sectional showroom; it is not a proposed street ramp.
 const barrierPivot=new T.Group();barrierPivot.name='Parking demo barrier arm pivot';barrierPivot.position.set(-11.3,1.02,-.8);group.add(barrierPivot);box(.35,1.05,.42,-11.3,0,-.8,m.dark,'Parking barrier demo pedestal');collider('barrier-pedestal',-11.3,-.8,.35,.42);
 const barrierObstacle=collider('barrier-arm',-10.1,-.8,2.4,.095);
 box(2.4,.09,.09,1.2,-.045,0,m.line,'Parking demonstrator moving barrier arm',barrierPivot,true);for(let i=0;i<4;i++)box(.22,.095,.095,.32+i*.6,-.047,0,m.red,'Parking demonstrator barrier reflective band',barrierPivot,true);
 label('ДЕМО ШЛАГБАУМ / НЕ ВЪЕЗД ЖК',3.4,.29,-11.15,1.9,-1.2,Math.PI/2);
 // EV connector and local animation explicitly demonstrate installation possibility.
 box(.28,1.3,.19,-2.7,0,-8.31,m.dark,'Parking EV wall charger concept');box(.17,.27,.02,-2.7,.89,-8.2,m.glass,'EV charger status screen');const evIndicator=box(.06,.12,.025,-2.7,1.0,-8.177,chargeLight,'Parking EV charging status indicator',group,true);
 const cableCurve=new T.CatmullRomCurve3([new T.Vector3(-2.75,.74,-8.2),new T.Vector3(-3.05,.31,-8.15),new T.Vector3(-3.78,.27,-7.68),new T.Vector3(-3.72,.73,-7.10)]);mesh(new T.TubeGeometry(cableCurve,14,.025,6,false),m.rubber,'EV connector authored hanging cable');box(.06,.17,.08,-3.72,.66,-7.10,m.dark,'EV demonstration connector');
 const chargeBar=box(.17,.023,.018,-2.7,.92,-8.162,chargeLight,'Parking local charging progress bar',group,true);
 label('EV / ВОЗМОЖНОСТЬ УСТАНОВКИ',3.3,.28,-2.7,1.75,-8.26,Math.PI);
 // Wayfinding LEDs guide to the author's illustrative bay111, without personal/car data.
 const routePoints=[[-10.6,-9.35],[-8.1,-9.35],[-8.1,-8.25],[-10.0,-8.25],[-10.0,-3.5],[-8.1,-2.7]],segments=[];
 for(let i=1;i<routePoints.length;i++){const a=routePoints[i-1],b=routePoints[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(l/.42));for(let j=0;j<n;j++)segments.push([a[0]+(b[0]-a[0])*(j+.5)/n,a[1]+(b[1]-a[1])*(j+.5)/n,Math.atan2(b[1]-a[1],b[0]-a[0])]);}
 const trail=new T.InstancedMesh(ownGeo(new T.BoxGeometry(.24,.024,.055)),blueLight,segments.length);trail.name='Parking find-my-car animated blue trail';trail.userData.parkingStatic=false;group.add(trail);trail.visible=false;const matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1),position=new T.Vector3();
 const beacon=box(.12,.18,.12,-8.1,1.64,-5.5,blueLight,'Parking illustrative bay111 location beacon',group,true);beacon.visible=false;
 const unknown='Вместимость ЖК, высота проездов, общее число уровней, точные габариты и привязка въезда к генплану не подтверждены источником; эта секция их не моделирует.';
 pois.push({id:'parking-lift',name:'Лифт / входная группа корпуса '+building,x:-10.7,z:-9.65,action:'amenity-route',targetRoom:'lobby',building,description:'Вернуться в входную группу выбранного корпуса. Паркинг показан самостоятельным авторским срезом: реальный лифтовой маршрут требует поэтажного проекта.'});
 pois.push({id:'parking-barrier',name:'Демо / шлагбаум',x:-10.4,z:-1.8,action:'parking-demo',parkingAction:'barrier',description:'Поворот демонстрационного шлагбаума внутри секции. Его положение не обозначает настоящий въезд в ЖК.'});
 pois.push({id:'parking-ev',name:'EV / возможность установки',x:-2.7,z:-9.25,action:'parking-demo',parkingAction:'charging',description:'Официально предусмотрена возможность установки зарядных станций на машиноместах. Кнопка запускает локальную сценическую анимацию, без подключения к зарядной сети.'});
 pois.push({id:'parking-storage',name:'Кладовые / −1 этаж',x:-6,z:8.75,action:'parking-demo',parkingAction:'storage',description:'Кладовые на −1 этаже подтверждены брошюрой. Размещение пяти демонстрационных комнат и дверь — авторская интерпретация; внутренняя площадь не заявляется и комнаты не открываются для прогулки.'});
 pois.push({id:'parking-find-car',name:'Найти автомобиль / демо 111',x:-10.3,z:-9.35,action:'parking-demo',parkingAction:'find-car',description:'Световой маршрут к иллюстративному месту111. Эти номера не являются распределением настоящих машиномест; персональные данные не используются.'});
 pois.push({id:'parking-info',name:'Паркинг / источники и ограничения',x:2.1,z:0,action:'parking-demo',parkingAction:'info',description:'Брошюра застройщика подтверждает подземный паркинг, места для велосипедов/мотоциклов, возможность установки EV-зарядок и кладовые на −1. '+unknown});
 pois.push({id:'parking-bicycle',name:'Велосипеды / отдельная зона',x:10.5,z:-4.4,action:'parking-demo',parkingAction:'info',description:'Места для велосипедов и мотоциклов подтверждены застройщиком. Геометрия велосипедов и расстановка здесь авторские.'});
 pois.push({id:'parking-motorcycle',name:'Мотоциклы / отдельная зона',x:-10.2,z:6.7,action:'parking-demo',parkingAction:'info',description:'Авторская модель мотоцикла с колёсами, рамой, двигателем и топливным баком в демонстрационной зоне.'});
 label('P / −1  •  АВТОРСКАЯ СЕКЦИЯ',4.2,.44,0,2.9,-11.88);label('УРОВЕНЬ −1 / КЛАДОВЫЕ',4.5,.4,0,2.92,11.87,Math.PI);
 // Merge static parts by material. Independent mechanisms and the ceiling remain separate.
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map();for(const o of staticMeshes){const list=batches.get(o.material)||[];list.push(o);batches.set(o.material,list);}
 for(const [material,items]of batches){const parts=items.map(o=>o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld))),g=ownGeo(merge(parts)),batch=new T.Mesh(g,material);batch.name='Batched source-inspired parking surfaces · '+items.length;batch.castShadow=batch.receiveShadow=true;group.add(batch);for(const o of items){o.removeFromParent();geos.delete(o.geometry);externalGeometry?.delete(o.geometry);o.geometry.dispose();}}
 for(const g of geos)stampGeometry(g,{label:'parking-v36/geometry',mutable:false});
 const world=createWalkWorld({boundary,solids,obstacles,radius:.25}),walker={x:-10.3,z:-9.35};
 const metadata={revision:36,concept:true,level:-1,floorY:0,localCoordinates:true,exteriorRegistration:false,sourceUrl:SOURCE_URL,sourcePage:45,sourcePdfSha256:'9520afc781211db3eff0168b096c767a94056fcc1912c5e558baa02e94b69d6b',sourceImage:'13.webp',sourceInspiration:['beige concrete','gold-purple-blue zone lighting','exposed service pipework','linear LEDs','floor arrows','linear drainage','illustrative 111–113 labels'],documentedServices:{undergroundParking:true,bicycleAndMotorcyclePlaces:true,possibilityOfEVChargerInstallation:true,storageLevel:-1},unknown:{complexCapacity:null,totalLevels:null,driveClearance:null,externalRampPosition:null,installedChargers:null},section:{width:26,depth:24,authorCeilingHeight:3.25,illustrativeBayCount:bays.length,bayWidth:2.5,bayDepth:5,vehicleAisle:6,notComplexCapacity:true},bays,parkedCars,columns,pedestrianRoute,wayfindingRoute:routePoints,storageRooms,parkingPlanStatus:'Source-inspired author layout, not the developer garage plan',siteEntranceStatus:'No external ramp coordinates proposed',chargingStatus:'Local non-network demonstration of installation possibility',storageAccess:'Doors are visual demonstrations; storage interiors remain reserved solids',unknownStatement:unknown,mainBuilding:building,initialSpawn:{...walker,y:1.68,yaw:-Math.PI/2,pitch:-.06},budget:{meshCount:0,triangles:0},authorship:{...ATTR,technicalLock:false}};
 group.traverse(o=>{o.userData.attribution={...ATTR};if(o.isMesh){metadata.budget.meshCount++;metadata.budget.triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});group.userData.reference=metadata;
 function setAction(id,value){if(dead||!['barrier','charging','storage','find-car','info'].includes(id))return false;states[id]=value===undefined?!states[id]:!!value;if(id==='charging'&&states.charging){states.chargingSeconds=0;states.chargingProgress=0;}trail.visible=beacon.visible=states['find-car'];return true;}
 function update(seconds){if(dead)return;time=Number.isFinite(seconds)?seconds:time;const dt=Math.max(0,Math.min(.1,time-lastTime));lastTime=time;const blend=1-Math.exp(-dt*7);
  const barrierTarget=states.barrier?Math.PI*.46:0;states.barrierAngle=barrierPivot.rotation.z+(barrierTarget-barrierPivot.rotation.z)*blend;barrierPivot.rotation.z=states.barrierAngle;
  barrierObstacle.enabled=states.barrierAngle<.95;
  states.storageAngle=storageDoor.rotation.y+((states.storage?-Math.PI*.43:0)-storageDoor.rotation.y)*blend;storageDoor.rotation.y=states.storageAngle;
  if(states.charging){states.chargingSeconds+=dt;states.chargingProgress=(states.chargingSeconds%30)/30;chargeBar.scale.x=Math.max(.025,states.chargingProgress);evIndicator.scale.y=.85+.15*Math.sin(time*3);}else{chargeBar.scale.x=.025;evIndicator.scale.y=1;}
  if(states['find-car']){for(let i=0;i<segments.length;i++){const [x,z,yaw]=segments[i],wave=.2+.8*Math.max(0,Math.sin(time*3-i*.28));position.set(x,.048,z);rotation.setFromAxisAngle(UP,-yaw);scale.set(.6+wave*.4,1,.55+wave*.45);matrix.compose(position,rotation,scale);trail.setMatrixAt(i,matrix);}trail.instanceMatrix.needsUpdate=true;beacon.scale.y=1+.2*Math.sin(time*4);}
 }
 function dispose(){if(dead)return;dead=true;trail.dispose();for(const g of geos){g.dispose();externalGeometry?.delete(g);}for(const material of materials){material.dispose();externalMaterials?.delete(material);}for(const texture of textures){texture.dispose();externalTextures?.delete(texture);}group.removeFromParent();}
 update(0);
 return{group,boundary:boundary.outer,shape:boundary,obstacles,solids,world,walker,overview:{position:[-20,19,22],target:[0,.8,0]},focus:{x:0,z:0,y:1.3},poi:pois,pois,ceiling,ceilings,metadata,floorY:0,heightAt:()=>0,spawnYaw:-Math.PI/2,spawnPitch:-.06,update,animation:update,dispose,setAction,states,objects:{barrierPivot,barrierObstacle,storageDoor,trail,beacon,chargeBar,evIndicator,lights},get anyRunning(){return states.barrier||states.storage||states.charging||states['find-car'];},get stats(){return{geometries:geos.size,materials:materials.size,textures:textures.size,meshes:metadata.budget.meshCount,triangles:metadata.budget.triangles};}};
}
