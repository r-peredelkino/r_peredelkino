// @r_peredelkino · physical distributed provenance; this does not prevent copying.
// Every bitmap pixel becomes a cuboid in an existing authored surface geometry.
// No new label Object3D or draw call is created. Parent scene owns all surfaces.
import * as T from './vendor/three.module.js';
import {attribution} from './attribution.js?v=publication371';
import {stampGeometry} from './baked-authorship.js?v=publication371';

export const voxelHandle='@r_peredelkino';
const glyphs=Object.freeze({
 '@':['01110','10001','10111','10101','10111','10000','01110'],
 r:['00000','00000','10110','11001','10000','10000','10000'],
 _:['00000','00000','00000','00000','00000','00000','11111'],
 p:['00000','00000','11110','10001','11110','10000','10000'],
 e:['00000','00000','01110','10001','11111','10000','01111'],
 d:['00001','00001','01101','10011','10001','10001','01111'],
 l:['01100','00100','00100','00100','00100','00100','01110'],
 k:['10000','10000','10010','10100','11000','10100','10010'],
 i:['00100','00000','01100','00100','00100','00100','01110'],
 n:['00000','00000','11110','10001','10001','10001','10001'],
 o:['00000','00000','01110','10001','10001','10001','01110']
});
const vec=value=>value?.isVector3?value.clone():new T.Vector3(...value);
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};

export function voxelBitmap(text=voxelHandle){
 const rows=Array.from({length:7},()=>[]);
 for(const [at,ch] of [...text].entries()){
  const glyph=glyphs[ch];if(!glyph)throw new Error('Unsupported physical provenance character: '+ch);
  for(let r=0;r<7;r++){if(at)rows[r].push(0);rows[r].push(...glyph[r].split('').map(Number));}
 }
 return {text,rows,columns:rows[0].length,pixels:rows.flat().filter(Boolean).length};
}

function assertCarrier(mesh){
 if(!mesh?.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.geometry?.isInstancedBufferGeometry)throw new Error('Physical provenance needs an owned static Mesh without unpacking instances');
 if(mesh.userData.dynamic||mesh.geometry.morphAttributes?.position?.length)throw new Error('Moving geometry cannot carry appended static provenance');
 const g=mesh.geometry,m=mesh.material;
 if(!g?.isBufferGeometry||!g.attributes.position||Array.isArray(m)||!m?.isMeshStandardMaterial||m.transparent||m.alphaTest>0)throw new Error('Carrier must have one opaque authored standard material');
 if(Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute))throw new Error('Interleaved and instanced geometry is not expanded');
 if(g.drawRange.start!==0||Number.isFinite(g.drawRange.count))throw new Error('A partial draw range cannot carry distributed provenance');
 if(g.attributes.position.count>220000)throw new Error('Refusing to copy a large facade carrier');
}

function normalizedPlacement(p){
 const bitmap=voxelBitmap(p.text||voxelHandle),u=vec(p.u||[1,0,0]).normalize(),v=vec(p.v||[0,0,-1]).normalize(),normal=u.clone().cross(v).normalize(),origin=vec(p.origin);
 if(![...origin,...u,...v,...normal].every(Number.isFinite)||Math.abs(u.dot(v))>1e-6||normal.lengthSq()<.99)throw new Error('Invalid orthogonal physical provenance basis');
 const pixel=p.pixel??.027,depth=p.depth??.008,gap=p.gap??.14;
 if(!(pixel>=.004&&pixel<=.08&&depth>=.002&&depth<=.02&&gap>=0&&gap<=.35))throw new Error('Provenance dimensions outside bounded relief budget');
 return {...p,bitmap,origin,u,v,normal,pixel,depth,gap};
}

function makeVoxelGeometry(p){
 const box=new T.BoxGeometry(p.pixel*(1-p.gap),p.pixel*(1-p.gap),p.depth),pos=[],norm=[],uv=[],indices=[];
 const basis=new T.Matrix4().makeBasis(p.u,p.v,p.normal),halfW=(p.bitmap.columns-1)*p.pixel/2,temp=new T.Vector3();
 for(let row=0;row<7;row++)for(let col=0;col<p.bitmap.columns;col++)if(p.bitmap.rows[row][col]){
  const offset=pos.length/3,center=p.origin.clone().addScaledVector(p.u,col*p.pixel-halfW).addScaledVector(p.v,(3-row)*p.pixel).addScaledVector(p.normal,p.depth/2);
  for(let i=0;i<box.attributes.position.count;i++){
   temp.fromBufferAttribute(box.attributes.position,i).applyMatrix4(basis).add(center);pos.push(temp.x,temp.y,temp.z);
   temp.fromBufferAttribute(box.attributes.normal,i).transformDirection(basis);norm.push(temp.x,temp.y,temp.z);
   uv.push((col+.5)/p.bitmap.columns,1-(row+.5)/7);
  }
  for(const index of box.index.array)indices.push(offset+index);
 }
 box.dispose();return {position:new Float32Array(pos),normal:new Float32Array(norm),uv:new Float32Array(uv),index:indices};
}

function appendVoxels(mesh,p,ownedMaterials){
 assertCarrier(mesh);const g=mesh.geometry,baseCount=g.attributes.position.count,oldIndex=g.index?.array,oldGroups=g.groups.map(x=>({...x})),vox=makeVoxelGeometry(p),added=vox.position.length/3,alreadyStamped=!!g.userData.pixelProvenance;
 // Geometry identity is preserved, including ownership sets and shadow proxies.
 const names=new Set([...Object.keys(g.attributes),'normal','uv','color']);
 for(const name of names){
  const old=g.attributes[name],size=old?.itemSize??(name==='uv'?2:3),Ctor=old?.array?.constructor??Float32Array,array=new Ctor((baseCount+added)*size);
  if(old)array.set(old.array);else if(name==='color')array.fill(1,0,baseCount*size);
  if(name==='position'||name==='normal'||name==='uv')array.set(vox[name],baseCount*size);
  else if(name==='color'){
   const tone=p.tone??.23,scale=old?.normalized?(Ctor===Uint8Array?255:Ctor===Uint16Array?65535:1):1;
   for(let i=baseCount;i<baseCount+added;i++)for(let c=0;c<size;c++)array[i*size+c]=c<3?tone*scale:scale;
  }
  const attr=new T.BufferAttribute(array,size,old?.normalized??false);if(old)attr.setUsage(old.usage);g.setAttribute(name,attr);
 }
 const sourceIndex=oldIndex||Array.from({length:baseCount},(_,i)=>i),combined=new (baseCount+added>65535?Uint32Array:Uint16Array)(sourceIndex.length+vox.index.length);
 combined.set(sourceIndex);for(let i=0;i<vox.index.length;i++)combined[sourceIndex.length+i]=baseCount+vox.index[i];g.setIndex(new T.BufferAttribute(combined,1));
 g.clearGroups();g.addGroup(0,combined.length,0);
 // Clone only the carrier material: shared facade/instance shaders stay intact.
 const material=mesh.material.clone();material.vertexColors=true;material.userData={...mesh.material.userData,attribution:{...attribution},physicalVoxelCarrier:true};material.needsUpdate=true;mesh.material=material;ownedMaterials?.add(material);
 delete g.parameters;g.type='BufferGeometry';g.toJSON=T.BufferGeometry.prototype.toJSON;g.computeBoundingBox();g.computeBoundingSphere();
 const record={text:p.bitmap.text,origin:p.origin.toArray(),u:p.u.toArray(),v:p.v.toArray(),normal:p.normal.toArray(),pixel:p.pixel,depth:p.depth,gap:p.gap,columns:p.bitmap.columns,rows:7,voxels:p.bitmap.pixels,startVertex:baseCount,baseVertices:baseCount,addedVertices:added,addedTriangles:vox.index.length/3,meshUuid:mesh.uuid,carrierName:mesh.name||'Authored surface',label:p.label||'surface',baseGroups:oldGroups};
 g.userData={...g.userData,attribution:{...attribution},voxelAuthorship:{revision:37,handle:voxelHandle,physical:true,additionalObjects:0,additionalDrawCalls:0,technicalCopyLock:false,records:[...(g.userData.voxelAuthorship?.records||[]),record]}};
 mesh.userData.voxelAuthorship={revision:37,handle:voxelHandle,physical:true,carrier:true};
 if(alreadyStamped){delete g.userData.pixelProvenance;stampGeometry(g,{label:p.label||'physical-voxel-surface'});}
 return {mesh,...record};
}

export function installVoxelAuthorship(root,{placements=[],label='scene',maxMarks=16,ownedMaterials=null}={}){
 if(placements.length>maxMarks)throw new Error('Distributed provenance carrier budget exceeded');
 const records=[],carriers=[],seen=new Set();let addedVertices=0,addedTriangles=0,voxels=0;
 const normalized=placements.map((placement,i)=>normalizedPlacement({...placement,label:placement.label||label+'/'+i}));
 for(const p of normalized){
  assertCarrier(p.mesh);
  if(seen.has(p.mesh.geometry))throw new Error('Each mark must use an independent owned geometry');
  if(p.mesh.geometry.userData.voxelAuthorship?.records?.length)throw new Error('Surface geometry already carries physical provenance');
  seen.add(p.mesh.geometry);
 }
 for(const p of normalized){
  const record=appendVoxels(p.mesh,p,ownedMaterials);records.push(record);carriers.push(p.mesh);addedVertices+=record.addedVertices;addedTriangles+=record.addedTriangles;voxels+=record.voxels;
 }
 const stats={revision:37,handle:voxelHandle,physical:true,carriers:carriers.length,marks:records.length,voxels,addedVertices,addedTriangles,additionalObjects:0,additionalMaterials:records.length,additionalTextures:0,additionalDrawCalls:0,maxRelief:Math.max(0,...records.map(r=>r.depth)),technicalCopyLock:false,sourceVerticesPreserved:true};
 if(root)root.userData.voxelAuthorship={...stats};let disposed=false;
 return {stats,carriers,records,verify(){return records.map(r=>({carrierName:r.carrierName,...readVoxelAuthorship(r.mesh.geometry,r)}));},dispose(){if(disposed)return;disposed=true;records.length=0;carriers.length=0;},get disposed(){return disposed;}};
}

// Recovery consults position vertices only, not names, metadata, custom
// attributes, texture pixels, groups or an appended-vertex starting offset.
export function readVoxelAuthorship(geometry,record,{tolerance=.00022}={}){
 const p=normalizedPlacement(record),positions=geometry?.attributes?.position;
 if(!positions)return {text:'',occupancy:[],expectedPixels:p.bitmap.pixels,recoveredPixels:0,complete:false};
 const keys=new Map(),quant=x=>Math.round(x/tolerance),key=(x,y,z)=>x+','+y+','+z;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),k=key(quant(x),quant(y),quant(z));
  let list=keys.get(k);if(!list){list=[];keys.set(k,list);}list.push([x,y,z]);
 }
 const has=point=>{const q=point.toArray().map(quant);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)for(const vertex of keys.get(key(q[0]+a,q[1]+b,q[2]+c))||[])if(Math.abs(vertex[0]-point.x)<=tolerance&&Math.abs(vertex[1]-point.y)<=tolerance&&Math.abs(vertex[2]-point.z)<=tolerance)return true;return false;};
 const occupancy=Array.from({length:7},()=>Array(p.bitmap.columns).fill(0)),half=p.pixel*(1-p.gap)/2,halfW=(p.bitmap.columns-1)*p.pixel/2;
 for(let row=0;row<7;row++)for(let col=0;col<p.bitmap.columns;col++){
  const center=p.origin.clone().addScaledVector(p.u,col*p.pixel-halfW).addScaledVector(p.v,(3-row)*p.pixel);let found=true;
  for(const du of [-half,half])for(const dv of [-half,half])for(const dn of [0,p.depth])if(!has(center.clone().addScaledVector(p.u,du).addScaledVector(p.v,dv).addScaledVector(p.normal,dn)))found=false;
  occupancy[row][col]=Number(found);
 }
 const recoveredPixels=occupancy.flat().filter(Boolean).length,complete=occupancy.every((r,y)=>r.every((b,x)=>b===p.bitmap.rows[y][x]));
 let decoded='';for(let x=0;x<p.bitmap.columns;x+=6){const sample=occupancy.map(r=>r.slice(x,x+5).join(''));decoded+=Object.entries(glyphs).find(([,g])=>g.every((r,y)=>r===sample[y]))?.[0]||'?';}
 return {text:decoded,occupancy,expectedPixels:p.bitmap.pixels,recoveredPixels,complete:complete&&decoded===p.bitmap.text};
}

function horizontalTriangles(mesh,basis){
 const g=mesh.geometry,pos=g.attributes.position,normal=g.attributes.normal,index=g.index?.array,out=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
 for(let at=0;at<(index?.length??pos.count);at+=3){
  const ids=index?[index[at],index[at+1],index[at+2]]:[at,at+1,at+2];
  a.fromBufferAttribute(pos,ids[0]);b.fromBufferAttribute(pos,ids[1]);c.fromBufferAttribute(pos,ids[2]);
  const heights=[a.dot(basis.n),b.dot(basis.n),c.dot(basis.n)];
  if(Math.max(...heights)-Math.min(...heights)>.00015)continue;
  const face=b.clone().sub(a).cross(c.clone().sub(a));if(face.dot(basis.n)<=1e-9)continue;
  if(normal&&ids.some(i=>n.fromBufferAttribute(normal,i).dot(basis.n)<.99))continue;
  const project=p=>[p.dot(basis.u),p.dot(basis.w)];out.push({y:heights.reduce((s,y)=>s+y,0)/3,a:project(a),b:project(b),c:project(c)});
 }
 return out;
}
const insideTri=(x,z,t)=>{const sign=(p,q)=>((x-q[0])*(p[1]-q[1])-(p[0]-q[0])*(z-q[1])),a=sign(t.a,t.b),b=sign(t.b,t.c),c=sign(t.c,t.a);return !(Math.min(a,b,c)<-1e-7&&Math.max(a,b,c)>1e-7);};

// Fit every physical pixel corner to real horizontal triangles rather than
// assuming a bounding-box centre is solid. No off-surface labels are placed.
export function findHorizontalSurfacePlacement(mesh,{pixel=.014,depth=.006,gap=.14,text=voxelHandle,tone=.23,preferCenter=true,label='horizontal surface'}={}){
 assertCarrier(mesh);const inverse=mesh.quaternion.clone().invert(),basis={u:new T.Vector3(1,0,0).applyQuaternion(inverse),w:new T.Vector3(0,0,1).applyQuaternion(inverse),n:new T.Vector3(0,1,0).applyQuaternion(inverse)},tris=horizontalTriangles(mesh,basis);if(!tris.length)return null;
 const bitmap=voxelBitmap(text),levels=[...new Set(tris.map(t=>Math.round(t.y*10000)/10000))].sort((a,b)=>b-a),half=bitmap.columns*pixel/2,hh=7*pixel/2;
 for(const y of levels){
  const level=tris.filter(t=>Math.abs(t.y-y)<.00015);let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const triangle of level)for(const p of [triangle.a,triangle.b,triangle.c]){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minZ=Math.min(minZ,p[1]);maxZ=Math.max(maxZ,p[1]);}
  if(maxX-minX<half*2||maxZ-minZ<hh*2)continue;
  const centers=[];if(preferCenter)centers.push([(minX+maxX)/2,(minZ+maxZ)/2]);
  for(let row=0;row<5;row++)for(let col=0;col<5;col++)centers.push([minX+half+(maxX-minX-half*2)*col/4,minZ+hh+(maxZ-minZ-hh*2)*row/4]);
  for(const [x,z] of centers){
   let fits=true;
   for(let row=0;row<7&&fits;row++)for(let col=0;col<bitmap.columns&&fits;col++)if(bitmap.rows[row][col])for(const dx of [-pixel*.5,pixel*.5])for(const dz of [-pixel*.5,pixel*.5]){
    const px=x+(col-(bitmap.columns-1)/2)*pixel+dx,pz=z+(row-3)*pixel+dz;if(!level.some(t=>insideTri(px,pz,t)))fits=false;
   }
   if(fits)return {mesh,origin:basis.u.clone().multiplyScalar(x).addScaledVector(basis.w,z).addScaledVector(basis.n,y+.0008).toArray(),u:basis.u.toArray(),v:basis.w.clone().negate().toArray(),pixel,depth,gap,text,tone,label};
  }
 }
 return null;
}

export function createDistributedSurfaceMarks(root,{label='authored interior',maxCarriers=3,pixel=.012,depth=.005,carriers=null,allowFloorDynamic=false,ownedMaterials=null}={}){
 const candidates=carriers||[];
 if(!carriers)root.traverse(mesh=>{if(!mesh.isMesh||!visible(mesh)||mesh.userData.shadowOnly||/shadow|ceiling|screen|television|glass|curtain|mirror/i.test(mesh.name))return;candidates.push(mesh);});
 const placements=[],seen=new Set();
 for(const mesh of candidates){
  if(placements.length>=maxCarriers)break;if(seen.has(mesh.geometry))continue;
  const dynamic=mesh.userData.dynamic;if(dynamic&&!(allowFloorDynamic&&/floor|slab|plane/i.test(mesh.name)))continue;
  if(dynamic)delete mesh.userData.dynamic;
  try{const p=findHorizontalSurfacePlacement(mesh,{pixel,depth,label:label+'/'+placements.length});if(p){placements.push(p);seen.add(mesh.geometry);}}
  catch{}finally{if(dynamic)mesh.userData.dynamic=dynamic;}
 }
 // Some tagged floors are static geometry merely excluded from furniture batching.
 const dynamicStates=placements.map(p=>p.mesh.userData.dynamic);placements.forEach((p,i)=>{if(dynamicStates[i])delete p.mesh.userData.dynamic;});
 try{return installVoxelAuthorship(root,{placements,label,maxMarks:maxCarriers,ownedMaterials});}
 finally{placements.forEach((p,i)=>{if(dynamicStates[i])p.mesh.userData.dynamic=dynamicStates[i];});}
}
