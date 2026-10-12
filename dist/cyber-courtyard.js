// @r_peredelkino · RP-CONCEPT-2026-10-07 · optional authored outdoor programme.
// This additive concept is not part of the developer's documented landscape.
// All reference paths, planting, surfaces, buildings and facades are retained.
import * as T from './vendor/three.module.js';
import {arenaPlacement} from './arena-placement-v35.js?v=publication371';
import {attribution} from './attribution.js?v=publication371';
import {bakeSceneAuthorship,embedPixelSignature} from './baked-authorship.js?v=publication371';
import {batchStatic} from './scene-batches.js?v=publication371';
import {createMineralMaterial} from './landscape-materials.js?v=publication371';
import {insideRing,solidContains,segmentDistance} from './walk-physics.js?v=publication371';
import {courtyardPassage} from './courtyard-passage.js?v=publication371';
import {frontageGroundHeight,forecourtRoadsideReserved} from './forecourt-ground.js?v=publication371';

const TAU=Math.PI*2;
export const cyberCourtyardConcept=Object.freeze({
 revision:34,author:attribution.handle,modelId:attribution.modelId,
 status:'Optional authored proposal; not a developer specification or surveyed layout',
 brief:'Quiet mineral and timber furniture; places to meet a team, rest and practise reaction outdoors',
 architecturalChanges:false,referenceLandscapeChanges:false,
 seeds:[
  {id:'cyber-seat-west',type:'seat',label:'Лавочка «Орбита»',point:[-18,-3],angle:.28+Math.PI,radius:1.85},
  {id:'cyber-seat-garden',type:'seat',label:'Лавочка «Команда»',point:[-4,33],angle:Math.PI,radius:1.85},
  {id:'cyber-seat-office',type:'seat',label:'Лавочка «Пауза»',point:[30,-37],angle:-1.45,radius:1.85},
  {id:'cyber-table-court',type:'tactics',label:'Тактический стол',point:[12,-2],angle:.15,radius:1.95},
  {id:'cyber-table-north',type:'tactics',label:'Командный стол',point:[-4,-43],angle:1.15,radius:1.95},
  {id:'cyber-reaction-arena',type:'reaction',label:'Реакция у арены',point:[-92+arenaPlacement.delta[0],14+arenaPlacement.delta[1]],angle:-1.3,radius:1.35,frontage:true}
 ]
});

function woodTexture(){
 const width=128,height=128,bytes=new Uint8Array(width*height*4);let seed=341011;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const grain=Math.sin((y+2.2*Math.sin(x*.045))*1.7)*.06+Math.sin(y*.29+x*.016)*.035;
  const tone=.87+grain+rnd()*.06,at=(y*width+x)*4;
  bytes.set([Math.round(248*tone),Math.round(236*tone),Math.round(219*tone),255],at);
 }
 embedPixelSignature(bytes,{label:'cyber-courtyard/timber-grain'});
 const map=new T.DataTexture(bytes,width,height,T.RGBAFormat);
 map.name='Authored warm ash grain · '+attribution.handle;
 map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(1.7,1);
 map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;
 map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=4;
 map.userData.attribution={...attribution};map.needsUpdate=true;return map;
}

// Small deterministic bitmap lettering avoids font downloads and canvas work
// during animation. The display is repainted only when its actual score changes.
const glyphs={
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','01110'],
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'C':['01111','10000','10000','10000','10000','10000','01111'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'I':['01110','00100','00100','00100','00100','00100','01110'],
 'L':['10000','10000','10000','10000','10000','10000','11111'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'P':['11110','10001','10001','11110','10000','10000','10000'],
 'R':['11110','10001','10001','11110','10100','10010','10001'],
 'S':['01111','10000','10000','01110','00001','00001','11110'],
 'T':['11111','00100','00100','00100','00100','00100','00100'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '.':['00000','00000','00000','00000','00000','00100','00100']
};
function panelTexture(){
 const width=256,height=128,bytes=new Uint8Array(width*height*4);
 const map=new T.DataTexture(bytes,width,height,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;
 map.name='Authored reaction display · '+attribution.handle;map.magFilter=T.LinearFilter;
 map.minFilter=T.LinearFilter;map.userData.attribution={...attribution};
 let last='';
 function draw(score=0,event=false){
  const value=Number.isFinite(+score)?Math.max(0,Math.min(9999,Math.round(+score))):0,key=value+'|'+event;if(key===last)return;last=key;
  for(let i=0;i<bytes.length;i+=4)bytes.set([22,39,41,255],i);
  function text(str,y,scale,color){const start=Math.floor((width-(str.length*6-1)*scale)/2);for(let k=0;k<str.length;k++){const glyph=glyphs[str[k]]||glyphs[' '];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1')for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){const x=start+(k*6+col)*scale+sx,py=y+(6-row)*scale+sy;if(x>=0&&x<width&&py>=0&&py<height)bytes.set([...color,255],(py*width+x)*4);}}}
  // Texture row zero is the bottom edge in Three.js DataTexture coordinates.
  text(event?'TEAM SESSION':'RP CLUSTER',96,2,[205,216,211]);
  text(String(value).padStart(3,'0'),43,5,[139,211,214]);
  text('REACTION',14,2,[177,193,186]);embedPixelSignature(bytes,{label:'cyber-courtyard/reaction-display'});map.needsUpdate=true;
 }
 draw();return{map,draw};
}

function arcShape(radius,halfAngle,width){
 const ring=[];for(let i=0;i<=48;i++){const a=-halfAngle+i/48*halfAngle*2;ring.push([(radius+width/2)*Math.sin(a),(radius+width/2)*Math.cos(a)-radius]);}
 for(let i=48;i>=0;i--){const a=-halfAngle+i/48*halfAngle*2;ring.push([(radius-width/2)*Math.sin(a),(radius-width/2)*Math.cos(a)-radius]);}
 return new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z)));
}
function roundedRectangle(width,depth,radius){
 const x=-width/2,z=-depth/2,w=width,d=depth,r=radius,s=new T.Shape();
 s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);
 s.lineTo(x+w,z+d-r);s.quadraticCurveTo(x+w,z+d,x+w-r,z+d);
 s.lineTo(x+r,z+d);s.quadraticCurveTo(x,z+d,x,z+d-r);
 s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;
}

export function createCyberCourtyard(root,{world,courtyardData,enabled=true}={}){
 if(!root?.isObject3D||typeof world?.free!=='function'||!courtyardData?.islands)throw new TypeError('Cyber courtyard requires the existing root, pedestrian world and reference courtyard data');
 const group=new T.Group();group.name='Optional authored cyber courtyard · calm timber and mineral furniture';root.add(group);
 const display=panelTexture(),materials={
  mineral:createMineralMaterial(0xdad8ce,{grain:.035,scale:1.6,name:'Fine mineral finish of cyber courtyard furniture'}),
  wood:new T.MeshStandardMaterial({color:0xb1926d,map:woodTexture(),roughness:.74,metalness:0}),
  bronze:new T.MeshStandardMaterial({color:0x7b7567,roughness:.44,metalness:.52}),
  graphite:new T.MeshStandardMaterial({color:0x34494b,roughness:.56,metalness:.15}),
  cyan:new T.MeshStandardMaterial({color:0xaacac7,emissive:0x58aeb8,emissiveIntensity:.15,roughness:.4}),
  amber:new T.MeshStandardMaterial({color:0xd1bea0,emissive:0xd7a664,emissiveIntensity:.10,roughness:.5}),
  screen:new T.MeshBasicMaterial({map:display.map,toneMapped:false})
 };
 const interactions=[],obstacles=[],placements=[],skipped=[],reactionPads=[];
 const paths=(courtyardData.paths||[]).map(p=>{
  const sampled=new T.CatmullRomCurve3(p.points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal').getPoints(90);
  return{width:p.width,points:sampled.map(p=>[p.x,p.z]),bounds:[Math.min(...sampled.map(p=>p.x))-p.width,Math.max(...sampled.map(p=>p.x))+p.width,Math.min(...sampled.map(p=>p.z))-p.width,Math.max(...sampled.map(p=>p.z))+p.width]};
 });
 const passageStart=courtyardPassage.route[0],passageEnd=courtyardPassage.route.at(-1);
 const exclusions=[...courtyardData.islands,...(courtyardData.referenceGeometry?.lounge?[{outer:courtyardData.referenceGeometry.lounge.clearance,holes:[]}]:[])];
 function sourceClear(x,z,frontage=false){
  if(!world.free(x,z)||forecourtRoadsideReserved(x,z,.4))return false;
  if(segmentDistance(x,z,passageStart,passageEnd)<courtyardPassage.width/2+1.25)return false;
  if(frontage)return true;
  if(!insideRing(x,z,courtyardData.boundary)||exclusions.some(p=>solidContains(x,z,p)))return false;
  if((courtyardData.latticeContours||[]).some(p=>insideRing(x,z,p)))return false;
  for(const zone of courtyardData.zones||[])if(((x-zone.x)/(zone.rx+.6))**2+((z-zone.z)/(zone.rz+.6))**2<1)return false;
  for(const path of paths){const b=path.bounds;if(x<b[0]||x>b[1]||z<b[2]||z>b[3])continue;for(let i=1;i<path.points.length;i++)if(segmentDistance(x,z,path.points[i-1],path.points[i])<path.width/2+.30)return false;}
  return true;
 }
 const transform=(anchor,angle,[x,z])=>[anchor[0]+Math.cos(angle)*x+Math.sin(angle)*z,anchor[1]-Math.sin(angle)*x+Math.cos(angle)*z];
 function placement(seed){
  const candidates=[[...seed.point]];
  for(const distance of [.7,1.4,2.1,2.8,3.5])for(let i=0;i<16;i++)candidates.push([seed.point[0]+Math.cos(i/16*TAU)*distance,seed.point[1]+Math.sin(i/16*TAU)*distance]);
  for(const point of candidates){
   if(placements.some(p=>Math.hypot(point[0]-p.point[0],point[1]-p.point[1])<seed.radius+p.radius+1.2))continue;
   const samples=[[0,0]];for(const r of [seed.radius*.45,seed.radius])for(let i=0;i<24;i++)samples.push([Math.cos(i/24*TAU)*r,Math.sin(i/24*TAU)*r]);
   const approach=transform(point,seed.angle,[0,seed.type==='seat'?-1.3:seed.type==='tactics'?-2.15:1.5]);
   if(!samples.every(q=>sourceClear(point[0]+q[0],point[1]+q[1],seed.frontage))||!sourceClear(...approach,seed.frontage))continue;
   // An approach must include a clear standing circle, rather than a single
   // free point hidden in a hedge or reachable only through the new furniture.
   if(!Array.from({length:12},(_,i)=>world.free(approach[0]+Math.cos(i/12*TAU)*.55,approach[1]+Math.sin(i/12*TAU)*.55)).every(Boolean))continue;
   const record={...seed,point,approach,ground:frontageGroundHeight(...point),offset:Math.hypot(point[0]-seed.point[0],point[1]-seed.point[1])};placements.push(record);return record;
  }
  skipped.push({id:seed.id,reason:'No unobstructed paved site within the bounded seed search'});return null;
 }
 const mesh=(geometry,material,parent=group)=>{const o=new T.Mesh(geometry,material);o.castShadow=!material.isMeshBasicMaterial;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,x,y,z,material,parent=group)=>{const o=mesh(new T.BoxGeometry(w,h,d),material,parent);o.position.set(x,y+h/2,z);return o;};
 function slab(shape,height,y,material,parent=group){const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.018,bevelThickness:.01,bevelSegments:1,curveSegments:16,steps:1});g.rotateX(-Math.PI/2);const o=mesh(g,material,parent);o.position.y=y;return o;}
 function addObstacle(o,id){obstacles.push({...o,source:'cyber-courtyard-v34',interactionId:id,enabled:!!enabled});}
 function assembly(p){const assembly=new T.Group();assembly.position.set(p.point[0],p.ground,p.point[1]);assembly.rotation.y=p.angle;assembly.name=p.label;group.add(assembly);return assembly;}
 function makeBench(p,index){
  const parent=assembly(p),r=1.52,half=.95,centerLine=[];
  slab(arcShape(r,half,.54),.24,.115,materials.mineral,parent).name='Continuous sculptural mineral bench support';
  // Separate radial ash lamellas keep real gaps, rounded edges and legible
  // wood grain without an expensive custom shader or one draw per lamella.
  for(let i=0;i<27;i++){
   const a=-half+(i+.5)/27*half*2,o=box(.083,.070,.59,r*Math.sin(a),.39,r*Math.cos(a)-r,materials.wood,parent);o.rotation.y=a;
   if(i>=3&&i<24){const b=box(.073,.23,.045,(r+.29)*Math.sin(a),.48,(r+.29)*Math.cos(a)-r,materials.wood,parent);b.rotation.y=a;}
  }
  slab(arcShape(r+.287,half*.86,.035),.037,.70,materials.wood,parent);
  for(let i=0;i<=48;i++){const a=-half+i/48*half*2;centerLine.push(new T.Vector3((r+.265)*Math.sin(a),.34,(r+.265)*Math.cos(a)-r));}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(centerLine),64,.011,4,false),index===1?materials.amber:materials.cyan,parent).name='Restrained continuous bench underlight';
  for(let i=0;i<16;i++){const a=-half+i/16*half*2,b=-half+(i+1)/16*half*2;addObstacle({type:'segment',a:transform(p.point,p.angle,[r*Math.sin(a),r*Math.cos(a)-r]),b:transform(p.point,p.angle,[r*Math.sin(b),r*Math.cos(b)-r]),radius:.32},p.id);}
  // The seat point is deliberately separate from the free standing approach.
  interactions.push({id:p.id,type:'seat',label:p.label,point:p.approach,objectPoint:p.point,radius:2.35,seatPoint:p.point,seatHeight:p.ground+.47,lookAt:transform(p.point,p.angle,[0,-4.0]),authoredConcept:true});
 }
 function makeTeamTable(p){
  const parent=assembly(p);
  slab(roundedRectangle(2.52,1.30,.24),.075,.83,materials.wood,parent).name='Rounded ash team table rim';
  slab(roundedRectangle(2.27,1.06,.17),.024,.915,materials.graphite,parent).name='Physical engraved tactical board';
  for(const x of [-.94,.94])mesh(new T.CylinderGeometry(.14,.24,.81,12),materials.mineral,parent).position.set(x,.435,0);
  // A generic abstract three-lane diagram is an original tabletop engraving.
  // It is not a reproduction of a game map or a commercial brand asset.
  for(const z of [-.30,0,.30])box(1.85,.006,.012,0,.943,z,materials.cyan,parent);
  for(const x of [-.80,0,.80])box(.014,.006,.76,x,.943,0,materials.bronze,parent);
  for(const [x,z] of [[-.83,-.31],[.83,.31],[-.45,.10],[.45,-.10]]){const o=mesh(new T.CylinderGeometry(.054,.054,.010,12),materials.amber,parent);o.position.set(x,.953,z);}
  addObstacle({type:'box',x:p.point[0],z:p.point[1],width:2.53,depth:1.32,angle:p.angle},p.id);
  for(const x of [-.71,.71])for(const z of [-1.13,1.13]){
   mesh(new T.CylinderGeometry(.24,.29,.39,18),materials.mineral,parent).position.set(x,.225,z);
   mesh(new T.CylinderGeometry(.29,.29,.065,24),materials.wood,parent).position.set(x,.459,z);
   const [cx,cz]=transform(p.point,p.angle,[x,z]);addObstacle({type:'circle',x:cx,z:cz,radius:.31},p.id);
  }
  interactions.push({id:p.id,type:'tactics',label:p.label,point:p.approach,objectPoint:p.point,radius:2.5,lookAt:p.point,authoredConcept:true});
 }
 function makeReactionStand(p){
  const parent=assembly(p);
  slab(roundedRectangle(1.35,.48,.17),.12,.02,materials.mineral,parent).name='Reaction stand mineral plinth';
  for(const x of [-.48,.48])box(.10,1.29,.15,x,.12,0,materials.mineral,parent);
  box(1.36,.73,.16,0,.93,0,materials.mineral,parent);
  box(1.23,.59,.17,0,1.01,.001,materials.graphite,parent);
  const screen=mesh(new T.PlaneGeometry(1.13,.42),materials.screen,parent);screen.position.set(0,1.36,.091);screen.name='Outdoor reaction display with authored pixel signature';
  for(let i=0;i<4;i++){
   const material=new T.MeshStandardMaterial({color:i%2?0xc8b89c:0x95bbb8,emissive:i%2?0xc08d48:0x36a6b4,emissiveIntensity:.08,roughness:.44,metalness:.12});
   materials['reaction-'+i]=material;const pad=mesh(new T.CylinderGeometry(.082,.082,.015,18),material,parent);pad.rotation.x=Math.PI/2;pad.position.set((i-1.5)*.28,1.075,.11);pad.userData.dynamic=true;pad.name='Reaction pad '+(i+1);reactionPads.push(pad);
  }
  const logo=box(.065,.026,.025,.60,1.67,0,materials.cyan,parent);logo.name='Small cyan reaction console accent';
  addObstacle({type:'box',x:p.point[0],z:p.point[1],width:1.39,depth:.52,angle:p.angle},p.id);
  interactions.push({id:p.id,type:'reaction',label:p.label,point:p.approach,objectPoint:p.point,radius:2.25,lookAt:p.point,authoredConcept:true});
 }
 for(const [index,seed] of cyberCourtyardConcept.seeds.entries()){const p=placement(seed);if(!p)continue;if(p.type==='seat')makeBench(p,index);else if(p.type==='tactics')makeTeamTable(p);else makeReactionStand(p);}
 // Flatten the individual assemblies, then merge their static meshes by shared
 // material. The four reaction pads alone remain independently switchable.
 group.updateMatrixWorld(true);
 for(const a of [...group.children])if(a.isGroup){for(const child of [...a.children])group.attach(child);group.remove(a);}
 batchStatic(group);
 const authored=bakeSceneAuthorship(group,{label:'cyber-courtyard-v34'});
 let visible=!!enabled,eventMode=false,night=0,reactionIndex=-1;
 group.visible=visible;
 const metadata={...cyberCourtyardConcept,placements:placements.map(p=>({id:p.id,type:p.type,point:p.point,approach:p.approach,angle:p.angle,registrationSearchOffset:p.offset})),skipped,meshCount:group.children.filter(o=>o.isMesh).length,interactions:interactions.length,collisionCount:obstacles.length,placementValidation:'Existing pedestrian world plus original planting, programme, garden paths, grass-paver wedges and protected passage; bounded seed search',visibilityIndependent:true};
 group.userData.concept=metadata;
 const preferred=interactions.find(p=>p.type==='tactics')||interactions[0];
 const destination=preferred?{name:'Кибердвор',point:preferred.point,look:preferred.objectPoint,originalArea:'courtyard',authoredConcept:true}:null;
 return{
  group,interactions,obstacles,colliders:obstacles,metadata,destination,
  setVisible(value){visible=!!value;group.visible=visible;for(const o of obstacles)o.enabled=visible;},
  setEventMode(value){eventMode=!!value;},
  update(time,{night:value=night,eventMode:mode=eventMode,reactionIndex:pad=reactionIndex,score=0}={}){
   night=T.MathUtils.clamp(Number.isFinite(+value)?+value:0,0,1);eventMode=!!mode;
   reactionIndex=Number.isFinite(+pad)?Math.trunc(+pad):-1;
   if(!visible)return;
   const pulse=eventMode?.91+.09*Math.sin((Number.isFinite(+time)?+time:0)*1.4):1;
   materials.cyan.emissiveIntensity=(.10+night*.80+(eventMode?.17:0))*pulse;
   materials.amber.emissiveIntensity=(.055+night*.62+(eventMode?.11:0))*pulse;
   reactionPads.forEach((p,i)=>{p.material.emissiveIntensity=i===reactionIndex?1.8:.055+night*.2;});
   display.draw(score,eventMode);
  },
  get visible(){return visible;},get eventMode(){return eventMode;},
  dispose(){root.remove(group);const geometries=new Set(),maps=new Set(authored.textures);group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const m of Object.values(materials)){for(const key of ['map','bumpMap','normalMap','roughnessMap','emissiveMap'])if(m[key])maps.add(m[key]);m.dispose();}geometries.forEach(g=>g.dispose());maps.forEach(m=>m.dispose());}
 };
}
