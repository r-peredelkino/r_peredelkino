// @r_peredelkino · observed forecourt cafe furniture, reference revision 29.
// All 10 shade contours, 25 table anchors and 54 visible chair anchors are supplied
// by the source trace. No extra generic tables, chairs, planters or planting are added.
import * as THREE from './vendor/three.module.js';
import {createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';

const TAU=Math.PI*2;
function finite(value,label){if(!Number.isFinite(value))throw new TypeError(`Forecourt cafe ${label} must be finite`);return value;}
function xz(value,label='point'){const p=Array.isArray(value)?value:[value?.x,value?.z];return[finite(p?.[0],`${label}.x`),finite(p?.[1],`${label}.z`)];}
function contour(values,label){
 if(!Array.isArray(values)||values.length<3)throw new TypeError(`Forecourt cafe ${label} needs an outer contour`);
 const p=values.map(v=>xz(v,label));if(Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-7)p.pop();
 let signed=0;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length];signed+=p[i][0]*b[1]-b[0]*p[i][1];}if(signed>0)p.reverse();
 return p;
}
function mean(p){return[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];}
function inside(x,z,p){let result=false;for(let i=0,j=p.length-1;i<p.length;j=i++){
 const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
}return result;}
function shape(outer,holes=[]){const s=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));for(const h of holes)s.holes.push(new THREE.Path(h.map(([x,z])=>new THREE.Vector2(x,-z))));return s;}
function circle(x,z,r,n=20){return Array.from({length:n},(_,i)=>[x+Math.cos(-i/n*TAU)*r,z+Math.sin(-i/n*TAU)*r]);}
function combine(parts){
 const gs=parts.map(g=>{if(!g.index)return g;const result=g.toNonIndexed();g.dispose();return result;}),n=gs.reduce((s,g)=>s+g.attributes.position.count,0),position=new Float32Array(n*3),normal=new Float32Array(n*3),uv=new Float32Array(n*2);let offset=0;
 for(const g of gs){position.set(g.attributes.position.array,offset*3);normal.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;g.dispose();}
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(position,3));out.setAttribute('normal',new THREE.BufferAttribute(normal,3));out.setAttribute('uv',new THREE.BufferAttribute(uv,2));out.computeBoundingSphere();return out;
}
function rodGeometry(a,b,r,sides=8){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start),length=delta.length();if(length<1e-8)throw new TypeError('Cafe support rod has zero length');const g=new THREE.CylinderGeometry(r,r,length,sides);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return g;}
function roundedSeatGeometry(){
 const s=new THREE.Shape(),w=.5,d=.46,r=.145;s.moveTo(-w+r,-d);s.lineTo(w-r,-d);s.quadraticCurveTo(w,-d,w,-d+r);s.lineTo(w,d-r);s.quadraticCurveTo(w,d,w-r,d);s.lineTo(-w+r,d);s.quadraticCurveTo(-w,d,-w,d-r);s.lineTo(-w,-d+r);s.quadraticCurveTo(-w,-d,-w+r,-d);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:.055,bevelEnabled:true,bevelSize:.020,bevelThickness:.010,bevelSegments:2,curveSegments:8});g.rotateX(-Math.PI/2);g.translate(0,.945,0);return g;
}
function curvedBackGeometry(){
 const pos=[],n=22;
 const p=(a,r,y)=>[Math.sin(a)*r,y,-.53+(1-Math.cos(a))*r];
 function quad(a,b,c,d){for(const q of[a,b,c,a,c,d])pos.push(...q);}
 for(let i=0;i<n;i++){
  const a=-.90+i/n*1.8,b=-.90+(i+1)/n*1.8,top=t=>1.79-.095*Math.pow(Math.abs(t/.9),5);
  const fa=p(a,.60,1.12),fb=p(b,.60,1.12),fc=p(b,.60,top(b)),fd=p(a,.60,top(a));
  const ba=p(a,.67,1.12),bb=p(b,.67,1.12),bc=p(b,.67,top(b)),bd=p(a,.67,top(a));
  quad(fb,fa,fd,fc);quad(ba,bb,bc,bd);quad(fd,bd,bc,fc);quad(fa,fb,bb,ba);
  if(i===0)quad(fa,ba,bd,fd);if(i===n-1)quad(bb,fb,fc,bc);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.computeVertexNormals();return g;
}
function chairFrameGeometry(){
 const parts=[];
 for(const side of[-1,1])for(const front of[-1,1])parts.push(rodGeometry([side*.44,.025,front*.41],[side*.37,.965,front*.33],.024,7));
 for(const side of[-1,1]){parts.push(rodGeometry([side*.37,.80,-.33],[side*.38,1.64,-.49],.020,7));parts.push(rodGeometry([side*.35,.81,-.34],[side*.35,.81,.34],.020,7));}
 for(const front of[-1,1])parts.push(rodGeometry([-.36,.81,front*.34],[.36,.81,front*.34],.020,7));
 return combine(parts);
}

/**
 * layout.cafes is an array of source clusters with roofs/tables/chairs.
 * Each outline/center is world XZ; every *Meters value is already in scene units.
 * layout.apronParts contains {outer,holes,id?} contours fitted by the caller to
 * the actual commercial facade. It is not expanded by this module.
 */
export function addForecourtCafes(parent,{layout={}}={}){
 const group=new THREE.Group();group.name='Source-traced commercial forecourt cafes · v29';group.userData={type:'forecourt-cafes',referenceVersion:29};parent.add(group);
 const baseY=finite(layout.baseY??.025,'baseY'),colliders=[],solids=[],ids=new Set(),objects=[],tables=[],chairs=[],roofs=[];
 const materials={
  fabric:new THREE.MeshStandardMaterial({color:0xf1f0e9,roughness:.94,metalness:0,side:THREE.DoubleSide}),
  terrace:createMineralMaterial(0x272d35,{grain:.065,scale:9,name:'Continuous dark stone cafe terrace'}),
  tabletop:new THREE.MeshStandardMaterial({color:0xb36247,roughness:.65,metalness:.08}),
  shell:new THREE.MeshStandardMaterial({color:0xaf634b,roughness:.69,metalness:.04,side:THREE.DoubleSide}),
  dark:new THREE.MeshStandardMaterial({color:0x454844,roughness:.54,metalness:.43}),
  rust:new THREE.MeshStandardMaterial({color:0x936449,roughness:.61,metalness:.28}),
 };
 materials.fabric.name='Thin white outdoor fabric shade';materials.tabletop.name='Terracotta circular cafe tabletops';materials.shell.name='Rounded terracotta cafe seats and curved backs';
 const metadata={version:29,source:layout.source??null,clusters:[],roofs:[],tables:[],chairs:[],aprons:[],supports:[],objects,roofCount:0,tableCount:0,chairCount:0,planterCount:0,extraFurnitureCount:0,supportAssumption:'Thin structural shade supports are necessary reconstruction details; hidden product-specific support positions are not claimed as surveyed.'};
 function register(id,type){if(!id||ids.has(id))throw new TypeError(`Forecourt cafe source id must be unique: ${id}`);ids.add(id);const record={id,type};objects.push(record);return record;}
 function add(geometry,material,id,type,name,cast=true){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=cast;mesh.receiveShadow=true;mesh.userData={sourceId:id,sourceIds:[id],type,referenceVersion:29,noAutomaticCollider:true};group.add(mesh);return mesh;}
 const aprons=(layout.apronParts??[]).map((p,i)=>({id:p.id??`forecourt-cafe-apron-${i+1}`,outer:contour(p.outer??p,`apron${i}`),holes:(p.holes??[]).map((h,j)=>contour(h,`apron${i}.hole${j}`))}));
 for(const apron of aprons){
  const record=register(apron.id,'cafe-apron'),g=new THREE.ShapeGeometry(shape(apron.outer,apron.holes));g.rotateX(-Math.PI/2);g.translate(0,baseY-.007,0);add(g,materials.terrace,apron.id,'cafe-apron','Dark terrace fitted against existing curved commercial facade',false);Object.assign(record,apron);metadata.aprons.push(record);
 }
 for(const cluster of layout.cafes??[]){
  const clusterMetadata={id:cluster.id,roofIds:[],tableIds:[],chairIds:[],placementConfidence:cluster.placementConfidence??null,occludedObjects:cluster.occludedObjects??null};metadata.clusters.push(clusterMetadata);
  for(const source of cluster.tables??[]){
   const record=register(source.id,'cafe-table'),[x,z]=xz(source.center,source.id),height=finite(source.heightMeters??.75,`${source.id}.height`),radius=finite(source.radiusMeters??.52,`${source.id}.radius`);if(height<=0||radius<=0)throw new TypeError(`Cafe table ${source.id} dimensions must be positive`);
   const t={sourceId:source.id,x,z,height,radius,clusterId:cluster.id};tables.push(t);Object.assign(record,t);metadata.tables.push(record);clusterMetadata.tableIds.push(source.id);colliders.push({type:'circle',x,z,radius:radius+.025});solids.push({outer:circle(x,z,radius),holes:[],sourceId:source.id,type:'cafe-table'});
  }
  for(const source of cluster.chairs??[]){chairs.push({source,cluster:clusterMetadata,clusterId:cluster.id});clusterMetadata.chairIds.push(source.id);}
  for(const source of cluster.roofs??[]){
   const record=register(source.id,'cafe-fabric-roof'),outer=contour(source.outer,source.id),center=source.center?xz(source.center,source.id):mean(outer),height=finite(source.heightMeters??3,`${source.id}.height`);if(height<=.5)throw new TypeError(`Cafe roof ${source.id} has no useful clear height`);
   const roof={sourceId:source.id,outer,center,height,clusterId:cluster.id};roofs.push(roof);Object.assign(record,roof,{heightConfidence:source.heightConfidence??null});metadata.roofs.push(record);clusterMetadata.roofIds.push(source.id);
  }
 }
 const tableById=new Map(tables.map(t=>[t.sourceId,t]));
 const chairRecords=chairs.map(({source,clusterId})=>{
  const record=register(source.id,'cafe-chair'),[x,z]=xz(source.center,source.id),height=finite(source.seatHeightMeters??.45,`${source.id}.seatHeight`),width=finite(source.seatWidthMeters??.45,`${source.id}.seatWidth`),table=tableById.get(source.lookAtTableId);
  if(!table)throw new TypeError(`Cafe chair ${source.id} references unknown table ${source.lookAtTableId}`);
  const dx=table.x-x,dz=table.z-z,len=Math.hypot(dx,dz);if(len<1e-6)throw new TypeError(`Cafe chair ${source.id} coincides with its table`);if(height<=0||width<=0)throw new TypeError(`Cafe chair ${source.id} dimensions must be positive`);
  const angle=Math.atan2(dx,dz),c=Math.cos(angle),s=Math.sin(angle),outer=[[-.53,-.59],[-.53,.48],[.53,.48],[.53,-.59]].map(([u,v])=>[x+c*u*width+s*v*width,z-s*u*width+c*v*width]);
  const chair={sourceId:source.id,x,z,height,width,angle,front:[dx/len,dz/len],lookAtTableId:source.lookAtTableId,clusterId};Object.assign(record,chair);metadata.chairs.push(record);colliders.push({type:'box',x,z,width:width*1.06,depth:width*1.09,angle});solids.push({outer,holes:[],sourceId:source.id,type:'cafe-chair'});return chair;
 });

 // Exact source roof borders form shallow fabric fans; the four-panel cluster
 // remains four physically separate roofs with visible gaps between their edges.
 const withinApron=p=>!aprons.length||aprons.some(a=>inside(p[0],p[1],a.outer)&&!a.holes.some(h=>inside(p[0],p[1],h)));
 const furniture=[...tables.map(t=>({x:t.x,z:t.z,r:t.radius+.10})),...chairRecords.map(c=>({x:c.x,z:c.z,r:c.width*.72}))];
 for(const roof of roofs){
  const {outer,center,height,sourceId:id}=roof,y=baseY+height,peak=height*.059,thickness=height*.0045,apex=[center[0],y+peak,center[1]],under=[center[0],y+peak-thickness,center[1]],positions=[];
  for(let i=0;i<outer.length;i++){
   const a=[outer[i][0],y,outer[i][1]],b=[outer[(i+1)%outer.length][0],y,outer[(i+1)%outer.length][1]],aa=[a[0],y-thickness,a[2]],bb=[b[0],y-thickness,b[2]];
   for(const q of[apex,a,b,under,bb,aa,a,aa,bb,a,bb,b])positions.push(...q);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));geo.computeVertexNormals();add(geo,materials.fabric,id,'cafe-fabric-roof','White fabric shade following its exact traced outer border');
  const candidates=[center];for(let i=0;i<outer.length;i++){
   const a=outer[i],b=outer[(i+1)%outer.length];for(const t of[.22,.50,.78]){const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];candidates.push([center[0]+(p[0]-center[0])*.82,center[1]+(p[1]-center[1])*.82]);}
  }
  const valid=candidates.filter(withinApron),pool=valid.length?valid:candidates;
  const score=p=>Math.min(...furniture.map(o=>Math.hypot(p[0]-o.x,p[1]-o.z)-o.r));pool.sort((a,b)=>score(b)-score(a));const support=pool[0],sx=support[0],sz=support[1];
  const postTop=[sx,y+peak*.18,sz],foot=[sx,baseY+.035,sz],armTop=[center[0],y+peak-thickness*2,center[1]],poleRadius=height*.010;
  add(rodGeometry(foot,postTop,poleRadius,9),materials.rust,id,'cafe-shade-support','Thin rust-coloured vertical shade support');add(rodGeometry(postTop,armTop,poleRadius*.76,8),materials.rust,id,'cafe-shade-support','Shallow cantilever arm below white fabric');
  if(Math.hypot(sx-center[0],sz-center[1])>.3)add(rodGeometry([sx,baseY+height*.73,sz],[center[0]+(sx-center[0])*.30,y+peak*.63,center[1]+(sz-center[1])*.30],poleRadius*.48,7),materials.rust,id,'cafe-shade-support','Fine diagonal support of the fabric cantilever');
  const plate=new THREE.CylinderGeometry(poleRadius*3.1,poleRadius*3.1,.028,14);plate.translate(sx,baseY+.014,sz);add(plate,materials.dark,id,'cafe-shade-base','Small weighted foot of shade support');
  for(const p of outer)add(rodGeometry([center[0],y+peak-thickness*2,center[1]],[p[0],y-thickness*1.6,p[1]],height*.0028,6),materials.rust,id,'cafe-fabric-rib','Fine supporting rib beneath observed fabric panel');
  const supportInfo={sourceId:id,x:sx,z:sz,height,withinApron:withinApron(support),furnitureClearance:score(support),placement:'Derived thin support inside observed roof footprint, preferring clear fitted terrace'};metadata.supports.push(supportInfo);colliders.push({type:'circle',x:sx,z:sz,radius:poleRadius*1.6});solids.push({outer:circle(sx,sz,poleRadius*1.7,12),holes:[],sourceId:id,type:'cafe-shade-post'});
 }

 const dummy=new THREE.Object3D();
 function instance(geometry,material,records,name,type,place){
  if(!records.length){geometry.dispose();return null;}const mesh=new THREE.InstancedMesh(geometry,material,records.length);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={type,sourceIds:records.map(r=>r.sourceId),referenceVersion:29,noAutomaticCollider:true};
  records.forEach((r,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);place(dummy,r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
 }
 const top=new THREE.CylinderGeometry(1,1,.055,32);top.translate(0,.9725,0);
 const stem=new THREE.CylinderGeometry(.082,.094,.905,10);stem.translate(0,.466,0);const foot=new THREE.CylinderGeometry(.46,.48,.033,24);foot.translate(0,.020,0);
 const tabletops=instance(top,materials.tabletop,tables,'Twenty-five traced circular terracotta tabletops','cafe-tabletop',(d,r)=>{d.position.set(r.x,baseY,r.z);d.scale.set(r.radius,r.height,r.radius);});
 const tableFrames=instance(combine([stem,foot]),materials.dark,tables,'Thin pedestals and small round feet of source cafe tables','cafe-table-frame',(d,r)=>{d.position.set(r.x,baseY,r.z);d.scale.set(r.radius,r.height,r.radius);});
 const seatGeometry=combine([roundedSeatGeometry(),curvedBackGeometry()]);
 const chairShells=instance(seatGeometry,materials.shell,chairRecords,'Fifty-four rounded source cafe seats and curved backs','cafe-chair-shell',(d,r)=>{d.position.set(r.x,baseY,r.z);d.rotation.y=r.angle;d.scale.set(r.width,r.height,r.width);});
 const chairFrames=instance(chairFrameGeometry(),materials.dark,chairRecords,'Thin splayed frames of the observed cafe chairs','cafe-chair-frame',(d,r)=>{d.position.set(r.x,baseY,r.z);d.rotation.y=r.angle;d.scale.set(r.width,r.height,r.width);});

 // Unique roof geometry and apron pieces share draw calls while retaining source IDs.
 const batches=new Map();for(const mesh of [...group.children]){
  if(!mesh.isMesh||mesh.isInstancedMesh)continue;const key=`${mesh.material.uuid}:${Number(mesh.castShadow)}`;let b=batches.get(key);if(!b){b={material:mesh.material,cast:mesh.castShadow,parts:[],sourceIds:new Set(),types:new Set()};batches.set(key,b);}
  mesh.updateMatrix();const g=mesh.geometry.clone();g.applyMatrix4(mesh.matrix);b.parts.push(g);for(const id of mesh.userData.sourceIds??[])b.sourceIds.add(id);b.types.add(mesh.userData.type);mesh.geometry.dispose();group.remove(mesh);
 }
 for(const b of batches.values()){const mesh=new THREE.Mesh(combine(b.parts),b.material);mesh.name=`Source cafe · ${[...b.types].join(', ')}`;mesh.castShadow=b.cast;mesh.receiveShadow=true;mesh.userData={sourceIds:[...b.sourceIds],types:[...b.types],referenceVersion:29,noAutomaticCollider:true};group.add(mesh);}
 metadata.roofCount=roofs.length;metadata.tableCount=tables.length;metadata.chairCount=chairRecords.length;metadata.apronCount=aprons.length;
 function setWetness(value){const wet=THREE.MathUtils.clamp(Number(value)||0,0,1);materials.terrace.roughness=.94-wet*.45;materials.tabletop.roughness=.65-wet*.27;materials.shell.roughness=.69-wet*.25;materials.fabric.roughness=.94-wet*.16;materials.dark.roughness=.54-wet*.14;}
 function setSeason(winter){materials.fabric.color.set(winter?0xe4ebe6:0xf1f0e9);}
 let disposed=false;
 return{group,materials,metadata,colliders,solids,tabletops,tableFrames,chairShells,chairFrames,setWetness,setSeason,dispose(){if(disposed)return;disposed=true;parent.remove(group);const geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();disposeOwnedMaterials(materials);}};
}
