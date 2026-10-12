// @r_peredelkino · source-traced forecourt architecture, reference revision 29.
// The closed silver pavilion has no assigned unseen interior or invented entrance.
// All plan outlines and placements are supplied by the shared reference layout.
import * as THREE from './vendor/three.module.js';
import {batchStatic} from './scene-batches.js?v=community38';
import {createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';
import {smoothWallNormals} from './facade-detail.js?v=community38';

const TAU=Math.PI*2;
const clamp01=value=>THREE.MathUtils.clamp(Number(value)||0,0,1);

function numeric(value,fallback,label){
 const result=value??fallback;
 if(!Number.isFinite(result))throw new TypeError(`Forecourt ${label} must be finite`);
 return result;
}

function xz(value){return Array.isArray(value)?[value[0],value[1]]:[value.x,value.z];}

function outline(points,id){
 if(!Array.isArray(points)||points.length<3)throw new TypeError(`Forecourt ${id} needs its traced outer outline`);
 const result=points.map(point=>{
  const [x,z]=xz(point);
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError(`Forecourt ${id} outline contains a non-finite point`);
  return[x,z];
 });
 if(Math.hypot(result[0][0]-result.at(-1)[0],result[0][1]-result.at(-1)[1])<1e-8)result.pop();
 if(result.length<3)throw new TypeError(`Forecourt ${id} outline is degenerate`);
 return result;
}

function openPath(points,id){
 if(!Array.isArray(points)||points.length<2)throw new TypeError(`Forecourt ${id} needs its open traced front edge`);
 const result=[];
 for(const point of points){
  const [x,z]=xz(point);
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new TypeError(`Forecourt ${id} edge contains a non-finite point`);
  if(!result.length||Math.hypot(x-result.at(-1)[0],z-result.at(-1)[1])>1e-7)result.push([x,z]);
 }
 if(result.length<2)throw new TypeError(`Forecourt ${id} edge is degenerate`);
 return result;
}

function pathNormals(points){
 return points.map((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  return[-dz/length,dx/length];
 });
}

function insideOutline(point,points){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}

function centerOf(points){
 let area=0,x=0,z=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],cross=a[0]*b[1]-b[0]*a[1];
  area+=cross;x+=(a[0]+b[0])*cross;z+=(a[1]+b[1])*cross;
 }
 return Math.abs(area)>1e-8?[x/(3*area),z/(3*area)]:[
  points.reduce((sum,p)=>sum+p[0],0)/points.length,
  points.reduce((sum,p)=>sum+p[1],0)/points.length,
 ];
}

function boundsOf(points){
 return{minX:Math.min(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),
  maxX:Math.max(...points.map(p=>p[0])),maxZ:Math.max(...points.map(p=>p[1]))};
}

/**
 * Consumes world-XZ source shapes. Expected layout members:
 * pavilion:{id,outer,baseY,height,roofThickness};
 * canopies:[{id,outer,roofY,thickness,tone,supports,rings}];
 * bar:{id,outer,height,thickness,legs,insets,stools};
 * insets:[{id,outer}], stools may specify baseStyle:'star';
 * socialSeating:[{id,tables:[{id,x,z,radius,height}],chairs:[{id,x,z,radius,height,angle}]}];
 * shellSeats:[{id,x,z,angle,width,depth,height}];
 * yellowBollards:[{id,x,z,radius,height}];
 * lamps:[{id,x,z,height,arm:[dx,dz],radius,baseY}];
 * gallery?:{id,outer,frontEdge,walkY,slabThickness,fasciaHeight,railingHeight}.
 * No geographic positions, outlined shapes or visible furniture counts are guessed here.
 */
export function addForecourtArchitecture(parent,{materials:sharedMaterials={},layout={}}={}){
 const group=new THREE.Group();
 group.name='Source-traced public forecourt architecture · v29';
 group.userData.type='forecourt-architecture';
 group.userData.referenceVersion=29;
 parent.add(group);

 // These materials are independently owned. Caller textures are never disposed here.
 const materials={
  pavilion:createMineralMaterial(0xe8e8e5,{grain:.022,scale:2,name:'Silver-white pavilion mineral envelope'}),
  pavilionRoof:createMineralMaterial(0xf0f0ec,{grain:.012,scale:2,name:'Thin white pavilion roof'}),
  darkRoof:new THREE.MeshStandardMaterial({color:0x46545e,roughness:.56,metalness:.09}),
  whiteRoof:new THREE.MeshStandardMaterial({color:0xe8e8e5,roughness:.70,metalness:.04}),
  whiteMetal:new THREE.MeshStandardMaterial({color:0xe8e8e5,roughness:Math.min(.58,sharedMaterials.white?.roughness??.48),metalness:.06,envMapIntensity:.35}),
  darkMetal:new THREE.MeshStandardMaterial({color:0x344149,roughness:.47,metalness:.36}),
  table:new THREE.MeshStandardMaterial({color:0x52595b,roughness:.66,metalness:.12}),
  tableInset:createMineralMaterial(0x514334,{grain:.065,scale:3,name:'Three dark brown inserts in the communal work table'}),
  yellow:new THREE.MeshStandardMaterial({color:0xe8c64c,roughness:.66,metalness:.04}),
  darkSeat:new THREE.MeshStandardMaterial({color:0x303b43,roughness:.68,metalness:.02}),
  shell:new THREE.MeshStandardMaterial({color:0xf0eee6,roughness:.64,metalness:.02}),
  shellInside:new THREE.MeshStandardMaterial({color:0xcfc8af,roughness:.84,metalness:0}),
  ring:new THREE.MeshStandardMaterial({color:0xdc36fa,emissive:0xdc36fa,emissiveIntensity:.55,roughness:.32,metalness:.04,toneMapped:false}),
  lamp:new THREE.MeshStandardMaterial({color:0xf8f4e7,emissive:0xffe9bd,emissiveIntensity:.02,roughness:.44}),
  galleryGlass:new THREE.MeshStandardMaterial({color:0xc5d0c9,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,roughness:.26,metalness:.04,envMapIntensity:.45}),
  galleryLight:new THREE.MeshStandardMaterial({color:0xf2eddf,emissive:0xffe7c4,emissiveIntensity:.01,roughness:.46}),
 };
 materials.pavilion.roughness=.54;materials.pavilion.metalness=.22;
 materials.pavilionRoof.roughness=.76;
 const colliders=[],solids=[],lamps=[],objects=[];
 const metadata={version:29,source:layout.source??layout.reference??null,
  pavilion:null,canopies:[],gallery:null,bar:null,socialSeating:[],shellSeats:[],yellowBollards:[],lamps:[],objects};
 const sourceIds=new Set();

 function register(id,type,details={}){
  if(!id||sourceIds.has(id))throw new TypeError(`Forecourt source id must be unique: ${id}`);
  sourceIds.add(id);
  const record={id,type,...details};objects.push(record);return record;
 }
 function add(geometry,material,id,type,name){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={type,sourceId:id,sourceIds:[id],noAutomaticCollider:true,referenceVersion:29};
  group.add(mesh);return mesh;
 }
 function slab(points,bottom,height,material,id,type,name){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:1,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,bottom,0);
  // Smooth only the traced organic perimeter. The opaque pavilion keeps its
  // observed straight, sharp corners; horizontal slab caps remain flat.
  if(type==='commercial-gallery-white-fascia'||type==='commercial-gallery-slab'||type.endsWith('-organic-canopy-roof'))smoothWallNormals(geometry);
  return add(geometry,material,id,type,name);
 }
 function cylinder(x,z,radius,height,bottom,material,id,type,name){
  const mesh=add(new THREE.CylinderGeometry(radius,radius,height,16),material,id,type,name);
  mesh.position.set(x,bottom+height/2,z);return mesh;
 }
 function rod(from,to,radius,material,id,type,name){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
  if(delta.length()<1e-6)return null;
  const mesh=add(new THREE.CylinderGeometry(radius,radius,delta.length(),10),material,id,type,name);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;
 }
 function box(width,height,depth,x,bottom,z,material,id,type,name,angle=0){
  const mesh=add(new THREE.BoxGeometry(width,height,depth),material,id,type,name);
  mesh.position.set(x,bottom+height/2,z);mesh.rotation.y=angle;return mesh;
 }
 function placed(x,z,angle,u,v){
  return[x+Math.cos(angle)*u+Math.sin(angle)*v,z-Math.sin(angle)*u+Math.cos(angle)*v];
 }

 if(layout.pavilion){
  const p=layout.pavilion,id=p.id,outer=outline(p.outer,id),baseY=numeric(p.baseY,.015,`${id}.baseY`);
  const height=numeric(p.height,undefined,`${id}.height`),roofThickness=numeric(p.roofThickness,.075,`${id}.roofThickness`);
  if(height<=roofThickness||roofThickness<=0)throw new RangeError(`Forecourt ${id} has an invalid pavilion height`);
  slab(outer,baseY,height-roofThickness,materials.pavilion,id,'opaque-pavilion-wall','Opaque silver pavilion following the traced outline');
  slab(outer,baseY+height-roofThickness,roofThickness,materials.pavilionRoof,id,'opaque-pavilion-roof','Thin white roof along the exact pavilion outline');
  const [x,z]=centerOf(outer);
  const record=register(id,'opaque-pavilion',{x,z,outer,baseY,height,roofThickness,bounds:boundsOf(outer),opaque:true});
  solids.push({id,type:'pavilion',outer,holes:[]});metadata.pavilion=record;
 }

 for(const c of layout.canopies??[]){
  const id=c.id,outer=outline(c.outer,id),roofY=numeric(c.roofY,undefined,`${id}.roofY`);
  const thickness=numeric(c.thickness,.14,`${id}.thickness`),tone=c.tone==='white'?'white':'dark';
  if(thickness<=0)throw new RangeError(`Forecourt ${id} roof thickness must be positive`);
  const [x,z]=centerOf(outer),roofMaterial=tone==='white'?materials.whiteRoof:materials.darkRoof;
  slab(outer,roofY,thickness,roofMaterial,id,`${tone}-organic-canopy-roof`,`${tone==='white'?'White kidney':'Dark organic'} roof following its source outline`);
  const supports=[],rings=[];
  for(const [index,s] of (c.supports??[]).entries()){
   const [sx,sz]=xz(s),radius=numeric(s.radius,.036,`${id}.support.radius`),baseY=numeric(s.baseY,.025,`${id}.support.baseY`);
   if(!Number.isFinite(sx)||!Number.isFinite(sz)||roofY<=baseY)throw new TypeError(`Forecourt ${id} support geometry is invalid`);
   const supportId=s.id??`${id}-support-${index+1}`;
   cylinder(sx,sz,radius,roofY-baseY,baseY,materials.whiteMetal,supportId,'canopy-support','Slender white canopy support');
   colliders.push({id:supportId,type:'circle',x:sx,z:sz,radius});
   supports.push(register(supportId,'canopy-support',{x:sx,z:sz,radius,baseY,topY:roofY,canopyId:id}));
  }
  for(const [index,r] of (c.rings??[]).entries()){
   const ringId=r.id??`${id}-ring-${index+1}`;
   const rx=numeric(r.x,undefined,`${ringId}.x`),rz=numeric(r.z,undefined,`${ringId}.z`);
   const y=numeric(r.y,undefined,`${ringId}.y`),radius=numeric(r.radius,undefined,`${ringId}.radius`);
   const angle=numeric(r.angle,0,`${ringId}.angle`),tubeRadius=numeric(r.tubeRadius,.04,`${ringId}.tubeRadius`);
   const frameRadius=tubeRadius*1.48,faceOffset=frameRadius*.63;
   const frame=add(new THREE.TorusGeometry(radius,frameRadius,8,48),materials.whiteMetal,ringId,'ring-frame','Thin physical support of hanging luminous ring');
   frame.position.set(rx,y,rz);frame.rotation.y=angle;
   for(const side of [-1,1]){
    const light=add(new THREE.TorusGeometry(radius,tubeRadius,8,48),materials.ring,ringId,'luminous-ring','Pink luminous ring, visible from both sides');
    light.position.set(rx+Math.sin(angle)*faceOffset*side,y,rz+Math.cos(angle)*faceOffset*side);
    light.rotation.y=angle;light.castShadow=false;
   }
   const topY=numeric(r.suspendFromY,roofY,`${ringId}.suspendFromY`),suspensionBottom=y+radius+frameRadius;
   if(topY>suspensionBottom)rod([rx,suspensionBottom,rz],[rx,topY,rz],.016,materials.whiteMetal,ringId,'ring-suspension','Fine suspension between ring and organic roof');
   const outerRadius=radius+frameRadius,a=placed(rx,rz,angle,-outerRadius,0),b=placed(rx,rz,angle,outerRadius,0);
   colliders.push({id:ringId,type:'segment',a,b,radius:frameRadius});
   rings.push(register(ringId,'luminous-ring',{x:rx,z:rz,y,radius,tubeRadius,outerRadius,angle,suspendFromY:topY,canopyId:id}));
  }
  const record=register(id,'organic-canopy',{x,z,outer,roofY,thickness,tone,supports,rings,bounds:boundsOf(outer)});
  metadata.canopies.push(record);
 }

 // The office's first-floor gallery is a separate architectural element from
 // the three garden roofs. The root layout fits this ribbon to the fixed podium.
 // Its traced front edge represents the plan position of the upper railing;
 // supplied section heights are reconstructed, not claimed as surveyed values.
 if(layout.gallery){
  const g=layout.gallery,id=g.id,outer=outline(g.outer,id),frontEdge=openPath(g.frontEdge,id);
  const walkY=numeric(g.walkY,undefined,`${id}.walkY`),slabThickness=numeric(g.slabThickness,undefined,`${id}.slabThickness`);
  const fasciaHeight=numeric(g.fasciaHeight,undefined,`${id}.fasciaHeight`),railingHeight=numeric(g.railingHeight,undefined,`${id}.railingHeight`);
  if(slabThickness<=0||fasciaHeight<=0||railingHeight<=.15)throw new RangeError(`Forecourt ${id} gallery section is invalid`);
  slab(outer,walkY-slabThickness,slabThickness,materials.whiteRoof,id,'commercial-gallery-slab','Curved first-floor gallery deck above the lower shops');
  const normals=pathNormals(frontEdge),fasciaWidth=.065;
  const offsetEdge=amount=>frontEdge.map(([x,z],i)=>[x+normals[i][0]*amount,z+normals[i][1]*amount]);
  const fascia=[...offsetEdge(fasciaWidth/2),...offsetEdge(-fasciaWidth/2).reverse()];
  slab(fascia,walkY-fasciaHeight,fasciaHeight,materials.whiteMetal,id,'commercial-gallery-white-fascia','Continuous white fascia along the source-facing gallery curve');

  const postRadius=.015,railRadius=.021,railY=walkY+railingHeight-railRadius;
  const cumulative=[0];
  for(let i=1;i<frontEdge.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(frontEdge[i][0]-frontEdge[i-1][0],frontEdge[i][1]-frontEdge[i-1][1]));
  const length=cumulative.at(-1),bays=Math.max(1,Math.ceil(length/1.35));
  let segment=1;
  for(let i=0;i<=bays;i++){
   const distance=length*i/bays;
   while(segment<cumulative.length-1&&cumulative[segment]<distance)segment++;
   const a=frontEdge[segment-1],b=frontEdge[segment],t=(distance-cumulative[segment-1])/(cumulative[segment]-cumulative[segment-1]);
   const x=THREE.MathUtils.lerp(a[0],b[0],t),z=THREE.MathUtils.lerp(a[1],b[1],t);
   cylinder(x,z,postRadius,railY-walkY,walkY,materials.darkMetal,id,'commercial-gallery-railing-post','Slender dark gallery railing post');
  }
  const glassPositions=[],glassUV=[],glassBottom=walkY+.047,glassTop=railY-.027;
  const [centerX,centerZ]=centerOf(outer);
  const soffitEdge=frontEdge.map(([x,z],i)=>{
   const n=normals[i],candidate=[x+n[0]*.14,z+n[1]*.14];
   const reverse=[x-n[0]*.14,z-n[1]*.14];
   const direction=insideOutline(candidate,outer)?1:insideOutline(reverse,outer)?-1:((centerX-x)*n[0]+(centerZ-z)*n[1]>=0?1:-1);
   return[x+n[0]*.14*direction,walkY-slabThickness-.014,z+n[1]*.14*direction];
  });
  for(let i=1;i<frontEdge.length;i++){
   const a=frontEdge[i-1],b=frontEdge[i];
   rod([a[0],railY,a[1]],[b[0],railY,b[1]],railRadius,materials.darkMetal,id,'commercial-gallery-top-rail','Fine dark handrail following the visible gallery curve');
   const q=[[a[0],glassBottom,a[1]],[b[0],glassBottom,b[1]],[a[0],glassTop,a[1]],[b[0],glassTop,b[1]]];
   for(const index of [0,1,2,2,1,3]){glassPositions.push(...q[index]);glassUV.push(index%2,index<2?0:1);}
   rod(soffitEdge[i-1],soffitEdge[i],.008,materials.galleryLight,id,'commercial-gallery-soffit-light','Subtle warm line beneath the first-floor gallery');
  }
  const glassGeometry=new THREE.BufferGeometry();
  glassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(glassPositions,3));
  glassGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(glassUV,2));glassGeometry.computeVertexNormals();
  const glass=add(glassGeometry,materials.galleryGlass,id,'commercial-gallery-glass','Subtle glass infill between the slim gallery railing posts');
  glass.castShadow=false;
  metadata.gallery=register(id,'commercial-gallery',{outer,frontEdge,walkY,slabThickness,fasciaHeight,railingHeight,
   length,railingPosts:bays+1,bounds:boundsOf(outer),groundSolid:false,
   referenceStatus:g.referenceStatus??'Reconstructed gallery section; dimensions are not surveyed'});
 }

 if(layout.bar){
  const b=layout.bar,id=b.id,outer=outline(b.outer,id),baseY=numeric(b.baseY,.025,`${id}.baseY`);
  const height=numeric(b.height,.8,`${id}.height`),thickness=numeric(b.thickness,.095,`${id}.thickness`);
  const topY=baseY+height,[x,z]=centerOf(outer),stools=[],insets=[];
  slab(outer,topY-thickness,thickness,materials.table,id,'work-table-top','Long dark communal work table');
  for(const [index,inset] of (b.insets??[]).entries()){
   const insetId=inset.id??`${id}-inset-${index+1}`,insetOuter=outline(inset.outer,insetId);
   slab(insetOuter,topY+.0015,.007,materials.tableInset,insetId,'work-table-inset','Source-traced dark brown tabletop insert');
   const record=register(insetId,'work-table-inset',{outer:insetOuter,topY:topY+.0085,bounds:boundsOf(insetOuter)});
   insets.push(record);
  }
  for(const leg of b.legs??[]){
   const [lx,lz]=xz(leg),radius=numeric(leg.radius,.058,`${id}.leg.radius`);
   cylinder(lx,lz,radius,height-thickness,baseY,materials.darkMetal,id,'work-table-leg','Thin dark work table leg');
  }
  solids.push({id,type:'work-table',outer,holes:[]});
  for(const [index,s] of (b.stools??[]).entries()){
   const sid=s.id??`${id}-chair-${index+1}`,sx=numeric(s.x,undefined,`${sid}.x`),sz=numeric(s.z,undefined,`${sid}.z`);
   const angle=numeric(s.angle,0,`${sid}.angle`),bottom=numeric(s.baseY,baseY,`${sid}.baseY`);
   const h=numeric(s.height,.47,`${sid}.height`),r=numeric(s.radius,.23,`${sid}.radius`);
   const tone=s.tone==='dark'?'dark':'yellow',material=tone==='dark'?materials.darkSeat:materials.yellow;
   cylinder(sx,sz,r,.05,bottom+h-.05,material,sid,'round-work-chair-seat','Round coloured seat beside the work table');
   const baseStyle=s.baseStyle==='star'?'star':'legs';
   if(baseStyle==='star'){
    cylinder(sx,sz,.043,h-.075,bottom+.025,material,sid,'work-chair-central-base','Central support of the source office-style chair');
    for(let spoke=0;spoke<5;spoke++){
     const a=spoke/5*TAU+.18,inner=placed(sx,sz,angle,Math.cos(a)*.035,Math.sin(a)*.035);
     const tip=placed(sx,sz,angle,Math.cos(a)*r*1.02,Math.sin(a)*r*1.02);
     rod([inner[0],bottom+.071,inner[1]],[tip[0],bottom+.035,tip[1]],.028,material,sid,'work-chair-star-base','Five low coloured spokes of the chair base');
    }
   }else{
    const legSpread=r*.58;
    for(const u of [-legSpread,legSpread])for(const v of [-legSpread,legSpread]){
     const [lx,lz]=placed(sx,sz,angle,u,v);
     rod([lx,bottom,lz],[lx,bottom+h-.055,lz],.019,materials.darkMetal,sid,'work-chair-leg','Slender work chair leg');
    }
   }
   if(s.backrest!==false){
    const [bx,bz]=placed(sx,sz,angle,0,r*.76);
    const back=add(new THREE.SphereGeometry(1,18,10),material,sid,'round-work-chair-back','Small round moulded chair back');
    back.position.set(bx,bottom+h+r*.79,bz);back.rotation.y=angle;back.scale.set(r*.95,r*.80,.032);
    for(const u of [-r*.58,r*.58]){
     const [lx,lz]=placed(sx,sz,angle,u,r*.72);
     rod([lx,bottom+h-.02,lz],[lx,bottom+h+r*.82,lz],.016,baseStyle==='star'?material:materials.darkMetal,sid,'work-chair-back-support','Fine chair back support');
    }
   }
   colliders.push({id:sid,type:'circle',x:sx,z:sz,radius:r+.055});
   const stool={id:sid,type:'work-chair',x:sx,z:sz,baseY:bottom,height:h,radius:r,angle,tone,baseStyle,backrest:s.backrest!==false};
   register(sid,'work-chair',stool);stools.push(stool);
  }
  metadata.bar=register(id,'work-table',{x,z,outer,baseY,height,thickness,stools,insets,bounds:boundsOf(outer)});
 }

 // The two small yellow seating pockets are independently traced. Hidden
 // furniture is not completed into symmetric table-and-chair arrangements.
 for(const s of layout.socialSeating??[]){
  const tables=[],chairs=[],groupId=s.id,firstMeshIndex=group.children.length;
  const circle=(x,z,r)=>Array.from({length:24},(_,i)=>[x+Math.cos(i/24*TAU)*r,z+Math.sin(i/24*TAU)*r]);
  for(const t of s.tables??[]){
   const id=t.id,x=numeric(t.x,undefined,`${id}.x`),z=numeric(t.z,undefined,`${id}.z`);
   const r=numeric(t.radius,undefined,`${id}.radius`),h=numeric(t.height,undefined,`${id}.height`),baseY=numeric(t.baseY,0,`${id}.baseY`);
   if(r<=0||h<=.1)throw new RangeError(`Forecourt ${id} table dimensions are invalid`);
   const thickness=Math.min(.04,h*.06);
   cylinder(x,z,r,thickness,baseY+h-thickness,materials.yellow,id,'yellow-social-tabletop','Observed small yellow circular tabletop');
   cylinder(x,z,r*.085,h-thickness-.03,baseY+.03,materials.yellow,id,'yellow-social-table-stem','Thin yellow table pedestal');
   cylinder(x,z,r*.39,.03,baseY,materials.yellow,id,'yellow-social-table-foot','Low unobtrusive yellow table base');
   const outer=circle(x,z,r);
   colliders.push({id,type:'circle',x,z,radius:r});solids.push({id,type:'social-table',outer,holes:[]});
   tables.push(register(id,'social-table',{x,z,radius:r,height:h,baseY,groupId,referenceStatus:t.referenceStatus??null}));
  }
  for(const c of s.chairs??[]){
   const id=c.id,x=numeric(c.x,undefined,`${id}.x`),z=numeric(c.z,undefined,`${id}.z`);
   const r=numeric(c.radius,undefined,`${id}.radius`),h=numeric(c.height,undefined,`${id}.height`),baseY=numeric(c.baseY,0,`${id}.baseY`),angle=numeric(c.angle,0,`${id}.angle`);
   if(r<=0||h<=.1)throw new RangeError(`Forecourt ${id} chair dimensions are invalid`);
   cylinder(x,z,r,.042,baseY+h-.042,materials.yellow,id,'yellow-social-chair-seat','Observed round yellow pocket chair seat');
   cylinder(x,z,.035,h-.072,baseY+.03,materials.yellow,id,'yellow-social-chair-stem','Thin yellow chair pedestal');
   for(let spoke=0;spoke<5;spoke++){
    const a=spoke/5*TAU+.18,tip=placed(x,z,angle,Math.cos(a)*r,Math.sin(a)*r);
    rod([x,baseY+.065,z],[tip[0],baseY+.029,tip[1]],.022,materials.yellow,id,'yellow-social-chair-foot','Low yellow spoke of the small chair base');
   }
   if(c.backrest!==false){
    const [bx,bz]=placed(x,z,angle,0,r*.76);
    const back=add(new THREE.SphereGeometry(1,18,10),materials.yellow,id,'yellow-social-chair-back','Rounded yellow chair back observed in the source');
    back.position.set(bx,baseY+h+r*.79,bz);back.rotation.y=angle;back.scale.set(r*.95,r*.80,.029);
    for(const u of [-r*.5,r*.5]){
     const [sx,sz]=placed(x,z,angle,u,r*.72);
     rod([sx,baseY+h-.02,sz],[sx,baseY+h+r*.82,sz],.014,materials.yellow,id,'yellow-social-chair-back-support','Fine yellow attachment of the chair back');
    }
   }
   const radius=r+.045,outer=circle(x,z,radius);
   colliders.push({id,type:'circle',x,z,radius});solids.push({id,type:'social-chair',outer,holes:[]});
   chairs.push(register(id,'social-chair',{x,z,radius:r,height:h,baseY,angle,groupId,backrest:c.backrest!==false,
    lookAtTableId:c.lookAtTableId??null,referenceStatus:c.referenceStatus??null}));
  }
  for(const mesh of group.children.slice(firstMeshIndex))mesh.userData.sourceIds.push(groupId);
  metadata.socialSeating.push(register(groupId,'social-seating',{tables,chairs,referenceStatus:s.referenceStatus??null,note:s.note??null}));
 }

 // A continuous double-sided shell: low open front, higher curved beige back.
 // It has no invented internal planting or furniture mechanism.
 for(const s of layout.shellSeats??[]){
  const id=s.id,x=numeric(s.x,undefined,`${id}.x`),z=numeric(s.z,undefined,`${id}.z`);
  const angle=numeric(s.angle,0,`${id}.angle`),width=numeric(s.width,undefined,`${id}.width`);
  const depth=numeric(s.depth,undefined,`${id}.depth`),height=numeric(s.height,undefined,`${id}.height`),baseY=numeric(s.baseY,.025,`${id}.baseY`);
  const segments=56,rings=12,thickness=Math.min(.06,height*.08);
  function shellPoint(radial,theta,inner){
   const inset=inner?1-thickness/Math.max(.1,Math.min(width,depth)/2):1;
   const u=Math.cos(theta)*width*.5*radial*inset,v=Math.sin(theta)*depth*.5*radial*inset;
   const back=.5+.5*Math.sin(theta),rim=height*(.22+.78*back);
   const y=baseY+thickness+(inner?thickness:0)+(rim-thickness)*radial*radial;
   const [px,pz]=placed(x,z,angle,u,v);return[px,y,pz];
  }
  function shellGeometry(inner){
   const positions=[],uv=[];
   for(let ring=0;ring<rings;ring++)for(let part=0;part<segments;part++){
    const r0=ring/rings,r1=(ring+1)/rings,a0=part/segments*TAU,a1=(part+1)/segments*TAU;
    const quad=[shellPoint(r0,a0,inner),shellPoint(r1,a0,inner),shellPoint(r0,a1,inner),shellPoint(r1,a1,inner)];
    for(const index of inner?[0,2,1,1,2,3]:[0,1,2,1,3,2]){positions.push(...quad[index]);uv.push(0,0);}
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
  }
  add(shellGeometry(false),materials.shell,id,'white-shell-exterior','Continuous white exterior of the shell seat');
  add(shellGeometry(true),materials.shellInside,id,'beige-shell-interior','Warm beige interior of the white shell');
  const rimPoints=Array.from({length:segments},(_,i)=>new THREE.Vector3(...shellPoint(1,i/segments*TAU,false)));
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints,true,'centripetal'),112,thickness*.55,7,true),materials.shell,id,'white-shell-rim','Fine continuous rim of the white shell');
  const base=cylinder(x,z,Math.min(width,depth)*.19,.085,baseY,materials.shell,id,'white-shell-base','Low unobtrusive shell support');base.scale.set(1.35,1,1);
  colliders.push({id,type:'box',x,z,width,depth,angle});
  metadata.shellSeats.push(register(id,'white-shell',{x,z,angle,width,depth,height,baseY}));
 }

 for(const b of layout.yellowBollards??[]){
  const id=b.id,x=numeric(b.x,undefined,`${id}.x`),z=numeric(b.z,undefined,`${id}.z`);
  const radius=numeric(b.radius,.16,`${id}.radius`),height=numeric(b.height,.7,`${id}.height`),baseY=numeric(b.baseY,.025,`${id}.baseY`);
  cylinder(x,z,radius,height,baseY,materials.yellow,id,'yellow-cylinder','Short yellow cylindrical plaza furnishing');
  colliders.push({id,type:'circle',x,z,radius});
  metadata.yellowBollards.push(register(id,'yellow-cylinder',{x,z,radius,height,baseY}));
 }

 for(const l of layout.lamps??[]){
  const id=l.id,x=numeric(l.x,undefined,`${id}.x`),z=numeric(l.z,undefined,`${id}.z`);
  const baseY=numeric(l.baseY,.025,`${id}.baseY`),height=numeric(l.height,undefined,`${id}.height`),radius=numeric(l.radius,.035,`${id}.radius`);
  const [dx,dz]=l.arm??[.28,0],length=Math.hypot(dx,dz);
  if(!Number.isFinite(length)||length<.06||height<.4)throw new RangeError(`Forecourt ${id} lamp arm or height is invalid`);
  const topY=baseY+height,bend=Math.min(.095,length*.32),nx=dx/length,nz=dz/length;
  rod([x,baseY,z],[x,topY-bend,z],radius,materials.whiteMetal,id,'white-bent-lamp-post','Slender white lamp post');
  const elbow=Array.from({length:13},(_,i)=>{
   const a=i/12*Math.PI/2,offset=bend*(1-Math.cos(a));
   return new THREE.Vector3(x+nx*offset,topY-bend+bend*Math.sin(a),z+nz*offset);
  });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(elbow),16,radius,8,false),materials.whiteMetal,id,'white-bent-lamp-elbow','Small bent white lamp elbow');
  rod([x+nx*bend,topY,z+nz*bend],[x+dx,topY,z+dz],radius,materials.whiteMetal,id,'white-bent-lamp-arm','Short horizontal white lamp arm');
  const luminousLength=Math.max(.04,length-bend-.04),lightCenter=length-luminousLength*.5-.015;
  box(luminousLength,.018,radius*1.32,x+nx*lightCenter,topY-radius-.018,z+nz*lightCenter,
   materials.lamp,id,'white-bent-lamp-light','Warm underside of the small white lamp',-Math.atan2(nz,nx));
  cylinder(x,z,radius*2.0,.024,baseY,materials.whiteMetal,id,'white-bent-lamp-foot','Flush white lamp mounting collar');
  colliders.push({id,type:'circle',x,z,radius});
  const lamp={id,x,z,y:topY-.035,color:0xffe9bd,height,baseY,arm:[dx,dz],radius};
  lamps.push(lamp);metadata.lamps.push(register(id,'white-bent-lamp',lamp));
 }

 // Batch by material while retaining all source-object identities on the new
 // nested meshes; the shared outer batching pass does not traverse this group.
 const provenance=new Map();
 for(const mesh of group.children){
  if(!mesh.isMesh)continue;
  let record=provenance.get(mesh.material);
  if(!record){record={ids:new Set(),types:new Set()};provenance.set(mesh.material,record);}
  mesh.userData.sourceIds.forEach(id=>record.ids.add(id));record.types.add(mesh.userData.type);
 }
 batchStatic(group);
 for(const mesh of group.children){
  if(!mesh.isMesh)continue;
  const record=provenance.get(mesh.material),ids=[...record.ids],types=[...record.types];
  mesh.name=`Forecourt ${types.length===1?types[0]:'architecture'} · ${mesh.material.name||mesh.material.color.getHexString()}`;
  mesh.userData={type:types.length===1?types[0]:'forecourt-architecture-batch',types,sourceIds:ids,
   sourceId:ids.length===1?ids[0]:null,noAutomaticCollider:true,referenceVersion:29};
 }
 metadata.counts={pavilions:metadata.pavilion?1:0,canopies:metadata.canopies.length,galleries:metadata.gallery?1:0,
  galleryRailingPosts:metadata.gallery?.railingPosts??0,
  darkCanopies:metadata.canopies.filter(c=>c.tone==='dark').length,
  rings:metadata.canopies.reduce((sum,c)=>sum+c.rings.length,0),chairs:metadata.bar?.stools.length??0,
  tableInsets:metadata.bar?.insets.length??0,
  socialGroups:metadata.socialSeating.length,
  socialTables:metadata.socialSeating.reduce((sum,g)=>sum+g.tables.length,0),
  socialChairs:metadata.socialSeating.reduce((sum,g)=>sum+g.chairs.length,0),
  shellSeats:metadata.shellSeats.length,yellowBollards:metadata.yellowBollards.length,lamps:lamps.length,
  solids:solids.length,colliders:colliders.length,draws:group.children.filter(o=>o.isMesh).length};
 group.userData.layoutObjects=objects;group.userData.reference=metadata.source;group.userData.counts=metadata.counts;

 const dryRoughness=new Map(Object.values(materials).map(material=>[material,material.roughness]));
 let night=0,wetness=0,winter=false,clock=0,disposed=false;
 function setNight(value){
  night=clamp01(value);materials.ring.emissiveIntensity=.55+night*3.1;
  materials.lamp.emissiveIntensity=.02+night*3.4;
  materials.galleryLight.emissiveIntensity=.01+night*.65;
 }
 function setSeason(value){
  winter=Boolean(value);materials.darkRoof.color.set(winter?0xb7c2c7:0x46545e);
  materials.whiteRoof.color.set(winter?0xe0e7e7:0xe8e8e5);
  materials.pavilionRoof.color.set(winter?0xe2e9e8:0xf0f0ec);
 }
 function setWetness(value){
  wetness=clamp01(value);
  for(const [material,dry] of dryRoughness)material.roughness=Math.max(.22,dry-wetness*.20);
 }
 function update(seconds){if(Number.isFinite(seconds))clock=seconds;}
 function dispose(){
  if(disposed)return;disposed=true;parent.remove(group);
  const geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});
  geometries.forEach(geometry=>geometry.dispose());disposeOwnedMaterials(materials);group.clear();
 }
 setNight(0);setSeason(false);
 return{group,colliders,solids,lamps,metadata,ownedMaterials:Object.values(materials),materials,
  setNight,setSeason,setWetness,update,dispose,
  get state(){return{night,wetness,winter,clock,disposed};}};
}
