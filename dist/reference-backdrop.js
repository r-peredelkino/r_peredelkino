import {registeredContextFootprints} from './context-services.js?v=publication371';
// @r_peredelkino · low commercial backdrop visible behind the courtyard in references 4–8.
import * as THREE from './vendor/three.module.js';
import {mapPoint,location} from './solar.js?v=publication371';
import {createMineralMaterial} from './landscape-materials.js?v=publication371';

const anchors={shopping:{e:-73,n:38,w:47,d:46,h:9},medical:{e:-92,n:92,w:27,d:21,h:8},utility:{e:-43,n:38,w:8,d:38,h:3}};
const heading=Math.atan2(location.north[0],location.north[1]);
const footprint=b=>[[b.e-b.w/2,b.n-b.d/2],[b.e+b.w/2,b.n-b.d/2],[b.e+b.w/2,b.n+b.d/2],[b.e-b.w/2,b.n+b.d/2]].map(([e,n])=>{const p=mapPoint(e,n);return[p[0],p[2]]});

export function addReferenceBackdrop(group){
 const materials={
  red:createMineralMaterial(0xa54c45,{grain:.055,scale:3,name:'Reference shopping frontage / muted red cladding'}),
  grey:createMineralMaterial(0x9a9fa0,{grain:.045,scale:5,name:'Reference shopping frontage / grey panel cladding'}),
  white:createMineralMaterial(0xe3e6df,{grain:.025,scale:2,name:'Reference context / light window frames and utility walls'}),
  plinth:createMineralMaterial(0x555d5c,{grain:.08,scale:3,name:'Reference context / dark base'}),
  roof:createMineralMaterial(0x626963,{grain:.19,scale:8,name:'Reference context / dark mineral roofs'}),
  joints:new THREE.MeshStandardMaterial({color:0x848d8c,roughness:.9}),
  steel:new THREE.MeshStandardMaterial({color:0x7e8b8d,roughness:.55,metalness:.3}),
  glass:new THREE.MeshStandardMaterial({color:0x657981,roughness:.32,metalness:.24}),
  darkGlass:new THREE.MeshStandardMaterial({color:0x34474e,roughness:.4,metalness:.18}),
  blue:new THREE.MeshStandardMaterial({color:0x367995,roughness:.82}),
  needles:createMineralMaterial(0x385631,{grain:.15,scale:4,name:'Reference context / dense conical arborvitae'}),
  bark:new THREE.MeshStandardMaterial({color:0x72664b,roughness:1})
 };
 const meshes=[],equipment=[];let framedWindows=0,activePart="shopping";
 function mesh(geometry,material,name){const object=new THREE.Mesh(geometry,material);object.name=name;object.userData.referencePart=activePart;object.castShadow=true;object.receiveShadow=true;group.add(object);meshes.push(object);return object;}
 // Symmetric boxes use -east as local X and north as local Z: this is a proper
 // rotation, not a reflected EN basis, so their winding remains outward.
 function box(w,h,d,e,n,y,material,name='Reference context detail'){
  const object=mesh(new THREE.BoxGeometry(w,h,d),material,name);object.position.set(...mapPoint(e,n,y+h/2));object.rotation.y=heading;return object;
 }
 function rod(a,b,r,material=materials.steel,name='Reference metal railing'){
  const start=new THREE.Vector3(...mapPoint(a[0],a[1],a[2])),end=new THREE.Vector3(...mapPoint(b[0],b[1],b[2])),delta=end.clone().sub(start);
  const object=mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),material,name);object.position.copy(start).add(end).multiplyScalar(.5);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return object;
 }
 function roof(b,y,trim=materials.red){
  box(b.w,.19,b.d,b.e,b.n,y-.19,materials.roof,'Dark mineral roof');
  for(const side of [-1,1]){box(.30,.37,b.d+.3,b.e+side*(b.w/2-.06),b.n,y,trim,'Continuous roof fascia');box(b.w,.37,.30,b.e,b.n+side*(b.d/2-.06),y,trim,'Continuous roof fascia');}
 }
 function eastWindow(e,n,y,width,height,{dark=false}={}){
  framedWindows++;
  box(.08,height,width,e+.035,n,y,dark?materials.darkGlass:materials.glass,'East-facing rectangular window');
  for(const side of [-1,1]){box(.14,.105,width+.14,e+.11,n,y+(side>0?height:0)-.0525,materials.white,'White horizontal window frame');box(.14,height+.105,.105,e+.11,n+side*width/2,y-.0525,materials.white,'White window jamb');}
  for(let i=1;i<4;i++)box(.145,height,.055,e+.115,n-width/2+width*i/4,y,materials.white,'Narrow window mullion');
  box(.145,.058,width,e+.115,n,y+height*.62,materials.white,'Window transom');
 }
 function southWindow(e,n,y,width,height){
  framedWindows++;box(width,height,.08,e,n-.035,y,materials.glass,'Side rectangular window');
  for(const side of [-1,1]){box(width+.14,.105,.14,e,n-.11,y+(side>0?height:0)-.0525,materials.white,'White side window frame');box(.105,height+.105,.14,e+side*width/2,n-.11,y-.0525,materials.white,'White side jamb');}
  for(let i=1;i<4;i++)box(.055,height,.145,e-width/2+width*i/4,n-.115,y,materials.white,'Side window mullion');
  box(width,.058,.145,e,n-.115,y+height*.62,materials.white,'Side window transom');
 }
 function plantUnit(e,n,w,d,y,h=.95){
  box(w,.17,d,e,n,y,materials.plinth,'Rooftop plant plinth');
  box(w*.94,h,d*.94,e,n,y+.17,materials.steel,'Rectangular rooftop plant');
  box(.04,h*.65,d*.73,e+w*.472,n,y+.32,materials.darkGlass,'Dark plant louvres');
  for(let i=0;i<5;i++)box(.055,.025,d*.76,e+w*.494,n,y+.34+i*h*.115,materials.steel,'Plant louvre blade');
  const fan=mesh(new THREE.CylinderGeometry(Math.min(w,d)*.25,Math.min(w,d)*.25,.09,12),materials.plinth,'Rooftop fan cap');fan.position.set(...mapPoint(e,n,y+h+.21));
  equipment.push({e,n,w,d,base:y,top:y+h+.255,part:activePart});
 }
 const base=-.65,b=anchors.shopping,front=b.e+b.w/2,roofY=base+b.h-.30;
 box(b.w,.45,b.d,b.e,b.n,base,materials.plinth,'Shopping centre dark base');
 box(b.w,3.85,b.d,b.e,b.n,base+.35,materials.red,'Shopping centre red ground storey');
 box(b.w,4.00,b.d,b.e,b.n,3.55,materials.grey,'Shopping centre grey upper storey');
 box(b.w,.49,b.d,b.e,b.n,7.53,materials.grey,'Shopping centre upper panel strip');
 roof(b,roofY);
 // The courtyard-facing elevation is EAST. The former draft decorated the south face.
 for(let i=0;i<8;i++)eastWindow(front,19.5+i*5.4,4.35,3.55,2.20);
 for(let i=0;i<6;i++)eastWindow(front,20.0+i*5.5,.48,4.0,2.43,{dark:true});
 for(let i=0;i<7;i++){southWindow(-92+i*5.9,15,4.35,3.45,2.20);southWindow(-92+i*5.9,15,.45,3.15,2.43);}
 for(let i=0;i<=15;i++)box(.022,4.22,.021,front+.013,15.45+i*2.97,3.66,materials.joints,'Grey facade panel seam');
 for(const y of [3.9,4.95,6.0,7.05])box(.025,.018,45.5,front+.015,38,y,materials.joints,'Horizontal facade panel seam');
 box(.14,.32,45.8,front+.045,38,3.32,materials.red,'Red line between storeys');
 // A shallow frontage gallery and two visible return stair flights.
 const galleryY=3.5;
 box(1.65,.14,29.5,front+.84,40.1,galleryY-.14,materials.steel,'Frontage gallery landing');
 for(let n=25.5;n<=54.8;n+=3.65){rod([front+1.57,n,base],[front+1.57,n,galleryY],.049);rod([front+1.57,n,galleryY],[front+1.57,n,galleryY+1.03],.032);}
 rod([front+1.57,25.35,galleryY+1.03],[front+1.57,54.85,galleryY+1.03],.034);
 rod([front+1.57,25.35,galleryY+.51],[front+1.57,54.85,galleryY+.51],.027);
 function flight(e,n0,n1,y0,y1){
  for(let i=0;i<11;i++){const u=(i+1)/11;box(1.32,.085,Math.abs(n1-n0)/11+.045,e,n0+(n1-n0)*u,y0+(y1-y0)*u-.085,materials.steel,'External stair tread');}
  for(const side of [-1,1]){const ee=e+side*.65;rod([ee,n0,y0-.06],[ee,n1,y1-.06],.068);rod([ee,n0,y0+1],[ee,n1,y1+1],.034);for(let i=0;i<=4;i++){const u=i/4,n=n0+(n1-n0)*u,y=y0+(y1-y0)*u;rod([ee,n,y],[ee,n,y+1],.027);}}
 }
 flight(front+3.48,51.9,58.1,base+.14,1.54);flight(front+1.94,58.1,51.9,1.54,galleryY);
 box(3.05,.13,1.5,front+2.70,58.65,1.41,materials.steel,'Return stair intermediate landing');
 box(2.62,.13,1.35,front+1.34,51.9,galleryY-.13,materials.steel,'Return stair upper landing');
 // Large roof rooms plus the smaller plant and ducts visible above the parapet.
 box(8.8,2.05,7.1,-85.9,50.9,roofY+.02,materials.red,'Red rooftop service room');
 box(9.0,.14,7.3,-85.9,50.9,roofY+2.07,materials.roof,'Service room flat roof');
 box(4.3,1.48,3.5,-91.0,21.2,roofY+.02,materials.red,'Small rooftop stair head');
 for(const [e,n,w,d,h] of [[-88,33,2.1,3.8,.8],[-80,25,3.8,2.2,.95],[-71,23,2.7,2.7,1],[-60.5,27,2.2,3.7,.9],[-66,42,4.2,2.8,1.12],[-59,53,2.2,2.9,.85],[-75,55,3.0,2.0,.8]])plantUnit(e,n,w,d,roofY+.08,h);
 for(const [e,n,w,d] of [[-79,34,11,.78],[-73.9,38,.78,8.5],[-65,49,7,.75],[-86,43,.75,8.5]])box(w,.52,d,e,n,roofY+.18,materials.steel,'Low rooftop duct');

 // Long low utility enclosure between the shopping frontage and the courtyard.
 activePart="utility";const u=anchors.utility,uy=base+u.h;
 box(u.w,.30,u.d,u.e,u.n,base,materials.plinth,'Utility enclosure base');
 box(u.w,2.71,u.d,u.e,u.n,base+.28,materials.white,'Long low white utility enclosure');
 roof(u,uy,materials.white);
 const uf=u.e+u.w/2;
 for(let n=20;n<=56;n+=2.2)box(.024,2.66,.020,uf+.015,n,base+.28,materials.joints,'Fine utility panel joint');
 for(let n=20.2;n<=56;n+=.75)box(7.3,.035,.075,u.e,n,uy+.13,materials.steel,'Low roof service grating');
 plantUnit(-43,47,2.0,3.0,uy+.15,1.5);plantUnit(-43,36.5,1.5,2.2,uy+.15,.75);
 box(1.05,.44,14,-43,40.5,uy+.21,materials.steel,'Utility roof duct');
 const thuja=[];
 for(let i=0;i<13;i++){
  const e=-37.6,n=18.9+i*3.15,height=3.15+(i%4)*.16;
  box(.19,.7,.19,e,n,base,materials.bark,'Arborvitae trunk');
  const profile=[[0,0],[.30,.13],[.51,.46],[.47,1.07],[.38,1.74],[.24,2.4],[.11,2.92],[0,3.35]].map(([x,y])=>new THREE.Vector2(x,y));
  const geometry=new THREE.LatheGeometry(profile,10),position=geometry.attributes.position;
  for(let j=0;j<position.count;j++){const y=position.getY(j),factor=1+.06*Math.sin(j*2.31+y*4.1);position.setXYZ(j,position.getX(j)*factor,y*height/3.35,position.getZ(j)*factor);}
  // Lathe pole rings contain duplicate vertices; omit their zero-area triangles.
  const kept=[],indices=geometry.index.array,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let j=0;j<indices.length;j+=3){a.fromBufferAttribute(position,indices[j]);b.fromBufferAttribute(position,indices[j+1]).sub(a);c.fromBufferAttribute(position,indices[j+2]).sub(a);if(b.cross(c).lengthSq()>1e-18)kept.push(indices[j],indices[j+1],indices[j+2]);}
  geometry.setIndex(kept);geometry.computeVertexNormals();
  const tree=mesh(geometry,materials.needles,'Thin conical arborvitae at the white enclosure');tree.position.set(...mapPoint(e,n,base+.19));tree.rotation.y=i*1.73;thuja.push({e,n,height});
 }

 // The second existing low building is the white/blue medical block farther north.
 activePart="medical";const m=anchors.medical,mfront=m.e+m.w/2,my=base+m.h-.24;
 box(m.w,my-base-.03,m.d,m.e,m.n,base,materials.white,'White and blue medical block');roof(m,my,materials.white);
 for(const y of [.23,3.95]){box(.10,2.72,m.d-.55,mfront+.025,m.n,y,materials.blue,'Blue medical frontage panel');box(m.w-.45,2.72,.10,m.e,m.n-m.d/2-.025,y,materials.blue,'Blue medical side panel');}
 for(let i=0;i<5;i++)for(const y of [.55,4.13])eastWindow(mfront+.10,84.0+i*4.0,y,2.55,2.13);
 for(let i=0;i<6;i++)for(const y of [.55,4.13])southWindow(-102.7+i*4.25,m.n-m.d/2-.10,y,2.53,2.13);
 box(2.1,m.h+.32,m.d+.12,m.e-m.w/2+1.02,m.n,base,materials.white,'Plain white medical corner bay');
 plantUnit(-92,92,2.7,3.5,my+.07,.80);

 // Register each existing detailed elevation to its measured street footprint.
 // This moves facade modules, stairs and roof equipment together; their heights
 // remain the existing reference estimates. The courtyard landscape is separate.
 const registrations={},registeredFootprints={};
 for(const part of ['shopping','medical','utility']){
  const target=registeredContextFootprints.find(b=>b.role===part),b=anchors[part];
  const corners=(part==='shopping'?[0,1,4,6]:[0,1,2,3]).map(i=>target.world[i]);
  const E=location.east,N=location.north,norm=E[0]**2+E[1]**2;
  let ev=null,best=-1;
  corners.forEach((p,i)=>{const q=corners[(i+1)%corners.length],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz);const v=[dx/l,dz/l],dot=v[0]*E[0]+v[1]*E[1];if(Math.abs(dot)>best){best=Math.abs(dot);ev=v.map(c=>c*Math.sign(dot));}});
  let nv=[ev[1],-ev[0]];if(nv[0]*N[0]+nv[1]*N[1]<0)nv=nv.map(c=>-c);
  const ep=corners.map(p=>p[0]*ev[0]+p[1]*ev[1]),np=corners.map(p=>p[0]*nv[0]+p[1]*nv[1]);
  const ce=(Math.min(...ep)+Math.max(...ep))/2,cn=(Math.min(...np)+Math.max(...np))/2;
  const center=[ev[0]*ce+nv[0]*cn,ev[1]*ce+nv[1]*cn],sw=(Math.max(...ep)-Math.min(...ep))/b.w,sd=(Math.max(...np)-Math.min(...np))/b.d;
  const a=ev[0]*E[0]/norm*sw+nv[0]*N[0]/norm*sd,c=ev[0]*E[1]/norm*sw+nv[0]*N[1]/norm*sd,d=ev[1]*E[0]/norm*sw+nv[1]*N[0]/norm*sd,f=ev[1]*E[1]/norm*sw+nv[1]*N[1]/norm*sd;
  const old=mapPoint(b.e,b.n),tx=center[0]-a*old[0]-c*old[2],tz=center[1]-d*old[0]-f*old[2];
  const matrix=new THREE.Matrix4().set(a,0,c,tx,0,1,0,0,d,0,f,tz,0,0,0,1);
  for(const object of meshes.filter(o=>o.userData.referencePart===part)){object.updateMatrix();object.geometry.applyMatrix4(object.matrix).applyMatrix4(matrix);object.position.set(0,0,0);object.rotation.set(0,0,0);object.scale.set(1,1,1);object.updateMatrix();}
  registrations[part]={osmWayId:target.id,address:target.address,center,planScale:[sw,sd],height:'retained reference estimate',matrix:matrix.toArray()};
  registeredFootprints[part]={outer:target.world,holes:[]};
 }
 // The medical building includes the rounded polygonal wing recorded by OSM.
 const medical=registeredContextFootprints.find(b=>b.role==='medical'),wing=[...medical.world.slice(3),medical.world[0]];
 const wingShape=new THREE.Shape(wing.map(([x,z])=>new THREE.Vector2(x,-z))),wingGeometry=new THREE.ExtrudeGeometry(wingShape,{depth:my-base,bevelEnabled:false,steps:1});wingGeometry.rotateX(-Math.PI/2);const wingShell=mesh(wingGeometry,materials.white,'Medical centre curved entrance wing');wingShell.position.y=base;
 const wingRoofGeo=new THREE.ShapeGeometry(wingShape);wingRoofGeo.rotateX(-Math.PI/2);const wingRoof=mesh(wingRoofGeo,materials.roof,'Medical curved wing flat roof');wingRoof.position.y=my+.012;
 for(let i=0;i<wing.length-1;i++){
  const a=wing[i],b=wing[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1)continue;
  for(const y of [.23,3.95]){const band=mesh(new THREE.BoxGeometry(len-.08,2.72,.05),materials.blue,'Blue curved medical wing band');band.position.set((a[0]+b[0])/2,y+1.36,(a[1]+b[1])/2);band.rotation.y=-Math.atan2(dz,dx);const pane=mesh(new THREE.BoxGeometry(len*.68,2.05,.065),materials.glass,'Medical entrance wing glazing');pane.position.copy(band.position);pane.rotation.copy(band.rotation);}
 }
 const metadata={version:28,registrations,referenceNumbers:[4,5,6,7,8],anchors,footprints:registeredFootprints ,shoppingFront:{e:front,nRange:[15,61],normalEN:[1,0],normalXZ:location.east.slice()},stairFlights:2,framedWindows,thuja,equipment,meshCount:meshes.length,triangles:meshes.reduce((sum,o)=>sum+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0),inventedSigns:false};
 group.userData.referenceBackdrop=metadata;
 return metadata;
}
