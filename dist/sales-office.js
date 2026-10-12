// @r_peredelkino · sales pavilion and forest-side approach reconstructed from references 1–3.
import * as THREE from './vendor/three.module.js';
import {batchStatic} from './scene-batches.js?v=community38';
import {crownGeometry,branchingTrunk} from './botanical-geometry.js?v=community38';
import {createFoliageMaterial,createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';

const P=[-40.5713,52.8479],T=[.8199,.5725],N=[-.5725,.8199];
export function salesOfficePoint(u,v){return[P[0]+T[0]*u+N[0]*v,P[1]+T[1]*u+N[1]*v]}
export const salesOfficeLayout={
 anchor:P,tangent:T,outward:N,center:salesOfficePoint(0,20.3),width:15.2,depth:18,
 lowRoof:4.12,highRoof:5.30,
 footprint:[[-7.6,11.3],[7.6,11.3],[7.6,29.3],[-7.6,29.3]].map(p=>salesOfficePoint(...p)),
 drive:[[-113.9348283,2.24936934],[-100,15],[-95,28],[-82,36],[-66,44],[-51.2709,52.4508],[-43.8918,57.6033],[-33.2331,65.0459],[-15,80],[3,88],[19,91],[34,92],[50,91],[62,88]],
 driveWidth:6.5,
 driveConnection:{sourceWayId:884735967,source:'Short inferred connection of the existing reference drive to the mapped frontage road; not an approved road design',approximate:true},
 forestEdge:[[-107.58782,-6.98342],[-111.69178,2.97432],[-112.9281,15.7207],[-119,33],[-102,51],[-81,66],[-64,87],[-48,106],[-28,121],[0,134],[36,139],[65,138],[99,128],[130,123]],
 rearParking:{x:37,z:104,width:44,depth:13},
 approach:[[55,91],[55,82]],
 referenceNumbers:[1,2,3]
};
export function distanceToSalesDrive(x,z){let best=Infinity;for(let i=1;i<salesOfficeLayout.drive.length;i++){
 const a=salesOfficeLayout.drive[i-1],b=salesOfficeLayout.drive[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
 best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
}return best}
export function salesOfficeReserved(x,z,pad=0){const dx=x-P[0],dz=z-P[1],u=dx*T[0]+dz*T[1],v=dx*N[0]+dz*N[1];
 return(u>-29-pad&&u<31+pad&&v>10-pad&&v<32+pad)||distanceToSalesDrive(x,z)<5.2+pad||(Math.abs(x-37)<24+pad&&Math.abs(z-104)<8+pad);
}
function shape(points){return new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)))}
function roundRect(x,z,w,d,r){const s=new THREE.Shape(),a=x-w/2,b=-z-d/2,c=x+w/2,e=-z+d/2;
 s.moveTo(a+r,b);s.lineTo(c-r,b);s.quadraticCurveTo(c,b,c,b+r);s.lineTo(c,e-r);s.quadraticCurveTo(c,e,c-r,e);s.lineTo(a+r,e);s.quadraticCurveTo(a,e,a,e-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);s.closePath();return s;
}
function curve(points,closed=false){return new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),closed,'centripetal')}
function ribbonPoints(points,width,closed=false){const path=curve(points,closed),samples=path.getPoints(closed?160:200),left=[],right=[];
 samples.forEach((p,i)=>{const tangent=path.getTangent(i/(samples.length-1)),nx=-tangent.z*width/2,nz=tangent.x*width/2;left.push([p.x+nx,p.z+nz]);right.push([p.x-nx,p.z-nz])});
 return{outer:[...left,...right.reverse()],holes:[],samples};
}

export function createSalesOffice(root){
 const group=new THREE.Group();group.name='Sales office, forest forecourt and future parking approach';root.add(group);
 const office=new THREE.Group();office.name='Two-level white and glazed sales office · references 1–2';office.position.set(P[0],0,P[1]);office.rotation.y=-Math.atan2(T[1],T[0]);group.add(office);
 const materials={
  white:createMineralMaterial(0xe9eae6,{grain:.03,name:'Sales office white architectural fascia'}),
  roof:createMineralMaterial(0x848a8a,{grain:.10,scale:3,name:'Sales office flat mineral roofs'}),
  glass:new THREE.MeshStandardMaterial({color:0x243d49,metalness:.52,roughness:.16}),
  frame:new THREE.MeshStandardMaterial({color:0x505c61,metalness:.35,roughness:.42}),
  asphalt:createMineralMaterial(0x515b5e,{grain:.13,scale:8,name:'External parking asphalt'}),
  paving:createMineralMaterial(0x899597,{grain:.06,scale:6,name:'Forest forecourt mineral pavers'}),
  road:createMineralMaterial(0x657275,{grain:.10,scale:12,name:'Forest-side service approach'}),
  grass:createMineralMaterial(0x668249,{grain:.19,scale:16,name:'Forest-edge meadow'}),
  soil:createMineralMaterial(0x594b3d,{grain:.15,scale:3,name:'Perennial planting mulch'}),
  leaf:createFoliageMaterial(0x638743),shrub:createFoliageMaterial(0x547536),
  bark:new THREE.MeshStandardMaterial({color:0x80654a,roughness:1}),
  timber:new THREE.MeshStandardMaterial({color:0x9e825b,roughness:.92}),
  blue:new THREE.MeshStandardMaterial({color:0x079ee0,roughness:.92}),
  rubber:new THREE.MeshStandardMaterial({color:0x263238,roughness:1}),
  yellow:new THREE.MeshStandardMaterial({color:0xd7ba55,roughness:.9}),
  pink:new THREE.MeshStandardMaterial({color:0xc0a6bc,emissive:0xc079dc,emissiveIntensity:0,roughness:.75}),
  light:new THREE.MeshStandardMaterial({color:0xf1eee0,emissive:0xffe7b0,emissiveIntensity:0,roughness:.6}),
  car:new THREE.MeshStandardMaterial({color:0xffffff,metalness:.25,roughness:.42})
 };
 const colliders=[],solids=[{outer:salesOfficeLayout.footprint,holes:[]}],lamps=[];
 const mesh=(g,m,parent=group)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};
 const box=(w,h,d,x,y,z,m,angle=0,parent=group)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y+h/2,z);o.rotation.y=angle;return o};
 const localBox=(w,h,d,u,y,v,m)=>box(w,h,d,u,y,v,m,0,office);
 function slab(s,y,h,m,parent=group){const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);const o=mesh(g,m,parent);o.position.y=y;return o}
 function surface(points,y,m,parent=group){const g=new THREE.ShapeGeometry(shape(points));g.rotateX(-Math.PI/2);const o=mesh(g,m,parent);o.position.y=y;o.castShadow=false;return o}
 function strip(points,width,y,m,closed=false){
  const data=ribbonPoints(points,width,closed),o=surface(data.outer,y,m);
  if(points===salesOfficeLayout.drive){
   // Join the existing forecourt level to the mapped frontage road without a
   // floating slab. The short unmeasured tie-in is explicitly marked above.
   const [a,b]=points,dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz,pos=o.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){
    const along=((pos.getX(i)-a[0])*dx+(pos.getZ(i)-a[1])*dz)/len2;
    const t=THREE.MathUtils.smoothstep(along,.16,.62),start=-.499-(.039-y);
    pos.setY(i,start+(y-start)*t-y);
   }
   pos.needsUpdate=true;o.geometry.computeVertexNormals();
  }
  return data;
 }
 function rod(a,b,r,m,parent=group){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),m,parent);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o}
 function localRod(a,b,r,m){return rod(a,b,r,m,office)}

 // One pavilion: its lower front roof and taller rear roof meet along a real step.
 slab(roundRect(0,20.3,15.45,18.25,.65),.025,.20,materials.white,office);
 localBox(14.55,3.2,17.45,0,.24,20.3,materials.frame);
 localBox(14.15,3.07,.09,0,.38,11.34,materials.glass);
 // Glazed flanks continue underneath both roof heights; opaque fronts alternate with glass.
 for(const side of [-1,1]){
  localBox(.09,3.07,8.68,side*7.48,.38,15.82,materials.glass);
  localBox(.09,4.29,8.55,side*7.48,.38,24.88,materials.glass);
  for(const v of [11.55,15.6,20.15,24.55,28.95])localBox(.38,v<20.3?3.31:4.53,.26,side*7.52,.24,v,materials.white);
  for(const v of [13.4,17.65,22.3,26.7])localBox(.12,v<20.3?3.1:4.28,.065,side*7.57,.36,v,materials.frame);
 }
 for(const u of [-7.25,-3.68,0,3.68,7.25])localBox(.28,3.27,.27,u,.24,11.26,materials.white);
 for(const u of [-5.6,-1.86,1.86,5.6])localBox(.93,3.04,.12,u,.39,11.18,materials.frame);
 localBox(14.65,4.6,.24,0,.22,29.12,materials.white);
 localBox(15.18,1.21,.32,0,3.68,20.23,materials.white);
 for(const [v,d,h] of [[15.81,9.52,4.12],[24.8,9.3,5.30]]){
  slab(roundRect(0,v,15.82,d,.70),h-.38,.28,materials.white,office);
  slab(roundRect(0,v,15.33,d-.42,.49),h-.10,.08,materials.roof,office);
  const edge=roundRect(0,v,15.84,d,.72),hole=roundRect(0,v,15.22,d-.61,.43);edge.holes.push(new THREE.Path(hole.getPoints(18).reverse()));
  slab(edge,h-.08,.23,materials.white,office);
  localBox(15.72,.07,.14,0,h-.43,v-d/2+.03,materials.white);
 }
 // Fine door frames, threshold and a recessed reception glow read through the dark glass.
 for(const u of [-.67,.67])localBox(.055,2.7,.10,u,.30,11.08,materials.frame);
 localBox(1.38,.055,.11,0,3.0,11.08,materials.frame);
 for(const u of [-.12,.12])localRod([u,1.18,11.0],[u,1.92,11.0],.019,materials.white);
 localBox(2.4,.045,1.2,0,.215,10.73,materials.roof);
 office.userData.reference={photos:[1,2],oneBuilding:true,roofHeights:[4.12,5.30],author:'@r_peredelkino'};

 // This apron deliberately extends beyond the former, too narrow landscape outline.
 const annex=[[-105,14],[-94,28],[-77,36],[-57,45],[-33,60],[-11,77],[6,82],[27,85],[52,84],[68,86],[79,112],[65,139],[36,140],[0,135],[-29,122],[-49,107],[-65,88],[-82,68],[-103,52],[-120,34]];
 surface(annex,-.006,materials.grass).name='Continuous green strip behind the sales office';
 const roadWalk=strip(salesOfficeLayout.drive,10.7,.008,materials.paving);
 strip(salesOfficeLayout.drive,6.5,.037,materials.road);
 strip(salesOfficeLayout.approach,7.5,.041,materials.road);
 const forecourt=[[-31,8.8],[32,8.8],[32,32.2],[-28,33.0],[-33,24]].map(p=>salesOfficePoint(...p));
 surface(forecourt,.020,materials.paving);
 strip(salesOfficeLayout.drive,6.5,.039,materials.road);
 // The future parking connection is the visible approach. The concealed underground portal is not invented.
 const parkingOutline=[[11.8,12.5],[29.4,12.5],[29.4,30.3],[11.8,30.3]].map(p=>salesOfficePoint(...p));
 surface(parkingOutline,.034,materials.asphalt);
 for(let i=0;i<=5;i++)strip([salesOfficePoint(14+i*2.8,23.5),salesOfficePoint(14+i*2.8,29.6)],.105,.045,materials.white);
 strip([salesOfficePoint(14,29.6),salesOfficePoint(28,29.6)],.105,.045,materials.white);
 surface([[14,97],[60,97],[60,111],[14,111]],.018,materials.asphalt);
 for(const z of [97.7,105.7])for(let i=0;i<=15;i++)strip([[15.2+i*2.8,z],[15.2+i*2.8,z+4.5]],.105,.037,materials.white);
 strip([[28,96],[29,91.5]],5.7,.046,materials.asphalt);

 // Bright small play pocket beside the sales office, distinct from the courtyard pavilion.
 const play=[[-27,16.3],[-23,13.9],[-19,15.1],[-15.5,14.4],[-10.5,18.5],[-12,23],[-16,24.2],[-18.5,28],[-24,27],[-27.5,22]].map(p=>salesOfficePoint(...p));
 const playRing=curve(play,true).getPoints(100).map(p=>[p.x,p.z]);surface(playRing,.047,materials.blue);
 const heading=-Math.atan2(T[1],T[0]);
 for(const [u,v,r,color] of [[-24,20,1.65,materials.rubber],[-16.2,19,1.45,materials.rubber],[-20,22.4,.68,materials.yellow]]){
  const q=salesOfficePoint(u,v),o=mesh(new THREE.SphereGeometry(r,16,8,0,Math.PI*2,0,Math.PI/2),color);o.scale.y=.55;o.position.set(q[0],.05,q[1]);colliders.push({type:'circle',x:q[0],z:q[1],radius:r});
 }
 for(const u of [-24,-14])for(const v of [23.5,26.0]){const q=salesOfficePoint(u,v);box(.17,1.43,.17,q[0],.05,q[1],materials.timber,heading);colliders.push({type:'circle',x:q[0],z:q[1],radius:.13})}
 for(const u of [-24,-14]){const a=salesOfficePoint(u,23.5),b=salesOfficePoint(u,26);rod([a[0],1.32,a[1]],[b[0],1.32,b[1]],.055,materials.timber)}
 const shelter=salesOfficePoint(-18,28);const shelterRoof=mesh(new THREE.CylinderGeometry(1.95,1.95,.17,32),materials.timber);shelterRoof.position.set(shelter[0],2.69,shelter[1]);
 for(let i=0;i<4;i++){const a=i*Math.PI/2,x=shelter[0]+Math.cos(a)*1.62,z=shelter[1]+Math.sin(a)*1.62;rod([x,.06,z],[x,2.63,z],.065,materials.timber);colliders.push({type:'circle',x,z,radius:.10})}

 // Two flowing garden loops are visible beyond the office in reference 3.
 const loops=[[[ -31,83],[-25,86],[-17,87],[-10,94],[-17,102],[-29,102],[-36,95]],[[ -11,102],[-1,103],[8,109],[10,119],[-1,124],[-14,118],[-16,110]]];
 loops[0]=loops[0].map(([x,z])=>[x+T[0]*10,z+T[1]*10]);
 for(const path of loops){strip(path,2.0,.055,materials.paving,true);strip(path,.095,.061,materials.pink,true)}
 // Small utility enclosures set within the green strip, as seen in the supplied views.
 box(5.9,2.8,4.6,-33.88,.03,102.92,materials.white,heading);box(6.1,.16,4.8,-33.88,2.83,102.92,materials.roof,heading);
 box(7.0,3.0,5.4,37,.02,120,materials.glass);box(7.3,.22,5.7,37,3.02,120,materials.roof);
 const utilityFootprint=[[-2.95,-2.3],[2.95,-2.3],[2.95,2.3],[-2.95,2.3]].map(([u,v])=>[-33.88+T[0]*u+N[0]*v,102.92+T[1]*u+N[1]*v]);
 solids.push({outer:utilityFootprint,holes:[]},{outer:[[33.5,117.3],[40.5,117.3],[40.5,122.7],[33.5,122.7]],holes:[]});

 // The short white posts and lamps follow the actual curved approach.
 const driveCurve=curve(salesOfficeLayout.drive),driveLength=driveCurve.getLength();
 for(let d=21;d<driveLength-3;d+=4.8){const u=d/driveLength,p=driveCurve.getPointAt(u),t=driveCurve.getTangentAt(u),x=p.x+t.z*4.1,z=p.z-t.x*4.1;
  const o=mesh(new THREE.CylinderGeometry(.23,.30,.47,14),materials.white);o.position.set(x,.285,z);colliders.push({type:'circle',x,z,radius:.28});
 }
 for(let d=27;d<driveLength-6;d+=18){const u=d/driveLength,p=driveCurve.getPointAt(u),t=driveCurve.getTangentAt(u),x=p.x-t.z*4.55,z=p.z+t.x*4.55;
  rod([x,.025,z],[x,4.1,z],.052,materials.white);for(let k=0;k<3;k++){const h=2.65+k*.43;rod([x,h,z],[x+.24,h+.1,z],.035,materials.white);const lamp=mesh(new THREE.CylinderGeometry(.12,.12,.10,12),materials.light);lamp.rotation.z=Math.PI/2;lamp.position.set(x+.29,h+.1,z)}
  lamps.push({x,z,y:3.7,color:0xffe8bb});colliders.push({type:'circle',x,z,radius:.08});
 }

 const shrubs=[],trees=[];let seed=24318;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 // Mulched ovals remain low enough to keep the glass frontage and the little blue play area legible.
 for(const [u,v,rx,rz] of [[-30,11.8,3.6,1.7],[-10,9.8,2.8,1.2],[-30,28,2.6,1.9],[33,27,2.5,2.1]]){
  const q=salesOfficePoint(u,v),s=roundRect(q[0],q[1],rx*2,rz*2,Math.min(rx,rz));surface(s.getPoints(28).map(p=>[p.x,-p.y]),.065,materials.soil);
  for(let i=0;i<15;i++){const a=random()*6.283,r=Math.sqrt(random());shrubs.push({x:q[0]+Math.cos(a)*rx*.9*r,z:q[1]+Math.sin(a)*rz*.9*r,size:.6+random()*.55})}
  trees.push({x:q[0],z:q[1],size:.75+random()*.22});
 }
 for(const [cx,cz,rx,rz] of [[-24,94,8,5],[-2,113,9,6],[6,124,12,5],[16,117,7,4],[-40,103,5,5]]){
  for(let i=0;i<25;i++){const a=random()*6.283,r=Math.sqrt(random());shrubs.push({x:cx+Math.cos(a)*rx*r,z:cz+Math.sin(a)*rz*r,size:.55+random()*.65})}
  for(let i=0;i<3;i++){const a=i*2.4+.4;trees.push({x:cx+Math.cos(a)*rx*.6,z:cz+Math.sin(a)*rz*.6,size:.8+random()*.45})}
 }
 const dummy=new THREE.Object3D();function instances(geometry,material,points,set){const o=new THREE.InstancedMesh(geometry,material,points.length);points.forEach((p,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);set(dummy,p,i);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});o.instanceMatrix.needsUpdate=true;o.castShadow=true;o.receiveShadow=true;group.add(o);return o}
 instances(crownGeometry(.64,1.05,false,0),materials.shrub,shrubs,(d,p,i)=>{d.position.set(p.x,.43*p.size,p.z);d.scale.set(p.size*1.4,p.size,p.size);d.rotation.y=i*2.4});
 instances(branchingTrunk(.15,5.5),materials.bark,trees,(d,p)=>{d.position.set(p.x,2.7*p.size,p.z);d.scale.set(p.size,p.size,p.size)});
 const crowns=instances(crownGeometry(2.0,5.2,false,1),materials.leaf,trees,(d,p,i)=>{d.position.set(p.x,6.3*p.size,p.z);d.scale.set(p.size,p.size,p.size);d.rotation.y=i*2.4});
 trees.forEach(p=>colliders.push({type:'circle',x:p.x,z:p.z,radius:.2}));
 const cars=Array.from({length:18},(_,i)=>({x:17+(i%13)*2.8,z:i<13?108:100,size:1}));
 const carColors=[0xc5cbc9,0x353c43,0xe7e8e3,0x668193,0x1f282f];
 const bodies=instances(new THREE.BoxGeometry(1.8,.72,4.25),materials.car,cars,(d,p)=>d.position.set(p.x,.62,p.z));cars.forEach((p,i)=>bodies.setColorAt(i,new THREE.Color(carColors[i%carColors.length])));bodies.instanceColor.needsUpdate=true;
 instances(new THREE.BoxGeometry(1.62,.56,2.26),materials.glass,cars,(d,p)=>d.position.set(p.x,1.25,p.z));
 const wheel=new THREE.CylinderGeometry(.32,.32,.22,8);wheel.rotateZ(Math.PI/2);
 instances(wheel,materials.rubber,cars.flatMap(p=>Array.from({length:4},(_,i)=>({x:p.x+(i%2?.88:-.88),z:p.z+(i<2?1.23:-1.23)}))),(d,p)=>d.position.set(p.x,.34,p.z));
 cars.forEach(p=>colliders.push({type:'box',x:p.x,z:p.z,width:1.85,depth:4.35,angle:0}));
 // White curved benches are small furnishings, never substitutes for the office volume.
 for(const [u,v] of [[-31,20],[33,17],[-30,33]]){const q=salesOfficePoint(u,v);box(3,.10,.62,q[0],.43,q[1],materials.white,heading);for(const side of [-1,1]){const p=salesOfficePoint(u+side,v);box(.13,.43,.52,p[0],.02,p[1],materials.frame,heading)}colliders.push({type:'box',x:q[0],z:q[1],width:3.1,depth:.7,angle:heading})}
 const treeMatrices=crowns.instanceMatrix.array.slice(),seasonMatrix=new THREE.Matrix4();
 batchStatic(office);batchStatic(group);
 return{group,office,materials,solids,colliders,lamps,center:salesOfficeLayout.center,layout:salesOfficeLayout,
  boundaryExtensions:[{outer:annex,holes:[]},{outer:roadWalk.outer,holes:[]}],
  destination:{name:'Офис продаж',point:[-42,60],look:salesOfficeLayout.center},
  setSeason(winter,month){materials.grass.color.set(winter?0xd9e3dd:0x668249);materials.shrub.color.set(winter?0x7b8879:0x547536);materials.leaf.color.set(winter?0x858e7c:[8,9,10].includes(month)?0x8a904a:0x638743);materials.roof.color.set(winter?0xd8e2e1:0x848a8a);for(let i=0;i<crowns.count;i++){seasonMatrix.fromArray(treeMatrices,i*16).scale(new THREE.Vector3(winter?.35:1,winter?.35:1,winter?.35:1));crowns.setMatrixAt(i,seasonMatrix)}crowns.instanceMatrix.needsUpdate=true},
  setNight(n){materials.light.emissiveIntensity=Number(n)*3.1;materials.pink.emissiveIntensity=Number(n)*1.5},
  setWetness(wet){materials.asphalt.roughness=wet?.43:.94;materials.road.roughness=wet?.51:.94;materials.paving.roughness=wet?.52:.94},
  dispose(){root.remove(group);const geos=new Set();group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.isInstancedMesh)o.dispose()});geos.forEach(g=>g.dispose());disposeOwnedMaterials(materials)}
 };
}
