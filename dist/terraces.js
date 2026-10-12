// @r_peredelkino · residential roof terraces from 12.03.36 / 39 / 41.
// Source contours and levels stay authoritative; planting and furniture are visual estimates.
import * as THREE from './vendor/three.module.js';
import {complexFootprints as f} from './complex-footprints.js?v=publication371';
import {createWalkWorld} from './walk-physics.js?v=publication371';
import {batchStatic} from './scene-batches.js?v=publication371';
import {retailLevels} from './frontage-zones.js?v=publication371';
import {createTerraceAccessGate} from './terrace-access.js?v=publication371';
import {crownGeometry} from './botanical-geometry.js?v=publication371';
import {createFoliageMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=publication371';

function deckCoordinates(geometry,angle){
 const p=geometry.attributes.position,uv=new Float32Array(p.count*2),c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)*c+p.getZ(i)*s;uv[i*2+1]=-p.getX(i)*s+p.getZ(i)*c}
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
function railSamples(rail,step=.56){
 const lengths=[0];for(let i=1;i<rail.length;i++)lengths.push(lengths.at(-1)+Math.hypot(rail[i][0]-rail[i-1][0],rail[i][1]-rail[i-1][1]));
 const total=lengths.at(-1),samples=[];if(total<1.4)return samples;let segment=0;
 for(let distance=.38;distance<total-.38;distance+=step){
  while(segment<rail.length-2&&lengths[segment+1]<distance)segment++;
  const a=rail[segment],b=rail[segment+1],length=lengths[segment+1]-lengths[segment];if(length<1e-8)continue;
  const t=(distance-lengths[segment])/length;samples.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,tx:(b[0]-a[0])/length,tz:(b[1]-a[1])/length});
 }
 return samples;
}
export function createTerraces(root){
 const runtimeTerraces=f.terraces.map(t=>({...t,level:retailLevels.roof}));
 const group=new THREE.Group();group.name='Second-floor planted terraces with glass balustrades';root.add(group);
 const mats={tile:new THREE.MeshStandardMaterial({color:0x4d4842,roughness:.89}),officeTile:new THREE.MeshStandardMaterial({color:0xd6d3ca,roughness:.87}),glass:new THREE.MeshStandardMaterial({color:0xc3dde1,roughness:.14,metalness:.12,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide}),metal:new THREE.MeshStandardMaterial({color:0xa9b5b5,roughness:.32,metalness:.72}),fabric:new THREE.MeshStandardMaterial({color:0xd3c9b9,roughness:.92}),wood:new THREE.MeshStandardMaterial({color:0x8b745b,roughness:.77}),pot:new THREE.MeshStandardMaterial({color:0xe4e2d8,roughness:.82}),planter:new THREE.MeshStandardMaterial({color:0x4c5550,roughness:.84}),leaf:new THREE.MeshStandardMaterial({color:0x4b6645,roughness:1}),hedgeLeaf:createFoliageMaterial(0x4b6645),grass:new THREE.MeshStandardMaterial({color:0x9da277,roughness:1}),light:new THREE.MeshStandardMaterial({color:0xffe8c1,emissive:0xffd595,emissiveIntensity:0})};
 mats.tile.name='Dark longitudinal residential terrace decking';
 mats.tile.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 terraceDeckUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nterraceDeckUV=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 terraceDeckUV;').replace('#include <color_fragment>','#include <color_fragment>\nfloat board=floor(terraceDeckUV.y/.145);\nfloat across=fract(terraceDeckUV.y/.145);\nfloat phase=fract(sin(board*12.9898)*43758.5453);\nfloat along=fract(terraceDeckUV.x/2.8+phase);\nfloat seam=min(min(across,1.0-across)*.145,min(along,1.0-along)*2.8);\nfloat grain=.025*sin(terraceDeckUV.x*3.1+board*4.7)+.013*sin(terraceDeckUV.x*37.0+board);\ndiffuseColor.rgb*=mix(.52,.90+phase*.15+grain,smoothstep(.0015,.0045,seam));')};mats.tile.customProgramCacheKey=()=> 'residential-longitudinal-terrace-deck';
 const mesh=(g,m,parent=group)=>{const o=new THREE.Mesh(g,m);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o};
 const box=(w,h,d,x,y,z,m,parent=group)=>{const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y+h/2,z);return o};
 const leaves=[],hedgeLeaves=[],blades=[],lamps=[],worlds=[],destinations=[],referenceDetails=[];
 for(const [index,t] of runtimeTerraces.entries()){
  const residential=t.id>0,deckAngle=(t.furniture[0]?.angle??0)+Math.PI/2;
  const shape=new THREE.Shape(t.outer.map(([x,z])=>new THREE.Vector2(x,-z)));for(const hole of t.holes)shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));const floorGeo=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false});floorGeo.rotateX(-Math.PI/2);if(residential)deckCoordinates(floorGeo,deckAngle);mesh(floorGeo,residential?mats.tile:mats.officeTile).position.y=t.level;
  // Individual panes and a continuous slender handrail, following the actual curved edge.
  for(const rail of t.rails){const pts=rail.map(([x,z])=>new THREE.Vector3(x,t.level+1.13,z));if(pts.length<2)continue;const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');const tube=mesh(new THREE.TubeGeometry(curve,Math.min(240,Math.max(24,pts.length*2)),.022,6,false),mats.metal);tube.name='Continuous terrace handrail';
   const positions=[],uv=[];for(let i=0;i<rail.length-1;i++){const p=rail[i],q=rail[i+1];if(Math.hypot(q[0]-p[0],q[1]-p[1])<.03)continue;for(const [v,h,u] of [[p,0,0],[q,0,1],[q,1,1],[p,0,0],[q,1,1],[p,1,0]]){positions.push(v[0],t.level+.015+h*1.08,v[1]);uv.push(u,h)}}const glassGeometry=new THREE.BufferGeometry();glassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));glassGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));glassGeometry.computeVertexNormals();mesh(glassGeometry,mats.glass).name='Curved transparent terrace balustrade';
   for(let at=0;at<curve.getLength();at+=2.1){const p=curve.getPointAt(at/curve.getLength());box(.026,1.14,.026,p.x,t.level,p.z,mats.metal)}
  }
  const colliders=[],chairPlacements=[],hedgePlacements=[];
  for(const [i,item] of t.furniture.entries()){
   const sofa=new THREE.Group();sofa.position.set(item.x,t.level+.07,item.z);sofa.rotation.y=item.angle;group.add(sofa);
   box(1.65,.34,.73,0,.1,0,mats.fabric,sofa);box(1.65,.39,.14,0,.38,.31,mats.fabric,sofa);for(const side of [-1,1]){box(.12,.27,.8,side*.82,.30,0,mats.fabric,sofa);for(const z of [-.24,.24])box(.035,.12,.035,side*.72,0,z,mats.metal,sofa)}
   const matrix=new THREE.Matrix4().makeRotationY(item.angle),v=new THREE.Vector3();const at=(x,z)=>v.set(x,0,z).applyMatrix4(matrix).add(new THREE.Vector3(item.x,0,item.z)).clone();
   const tablePoint=at(0,-1.05),table=mesh(new THREE.CylinderGeometry(.38,.38,.055,24),mats.wood);table.position.set(tablePoint.x,t.level+.49,tablePoint.z);box(.055,.48,.055,tablePoint.x,t.level,tablePoint.z,mats.metal);colliders.push({type:'box',x:item.x,z:item.z,width:1.8,depth:.9,angle:item.angle},{type:'circle',x:tablePoint.x,z:tablePoint.z,radius:.39});
   const plant=at(i%2?1.1:-1.1,.5);box(.56,.55,.56,plant.x,t.level,plant.z,mats.pot);colliders.push({type:'circle',x:plant.x,z:plant.z,radius:.36});for(let j=0;j<8;j++){const a=j*2.4;leaves.push([plant.x+Math.cos(a)*.18,t.level+.76+(j%3)*.12,plant.z+Math.sin(a)*.18,.29])}
   const reed=at(i%2?-1.1:1.1,.45);const planter=mesh(new THREE.CylinderGeometry(.25,.21,.5,18),mats.pot);planter.position.set(reed.x,t.level+.25,reed.z);colliders.push({type:'circle',x:reed.x,z:reed.z,radius:.27});for(let j=0;j<13;j++)blades.push([reed.x+Math.sin(j*2.4)*.15,t.level+.88,reed.z+Math.cos(j*2.4)*.15,.65+(j%4)*.1,j*.47]);
   const lp=at(.58,-.94),lamp=mesh(new THREE.CylinderGeometry(.05,.09,.12,10),mats.light);lamp.position.set(lp.x,t.level+.60,lp.z);lamps.push({x:lp.x,y:t.level+.65,z:lp.z});
  }
  const solids=t.holes.map(h=>({outer:h,holes:[]})),originalObstacles=colliders.slice(),originalSpawn=createWalkWorld({boundary:t.outer,solids,obstacles:originalObstacles}).nearest(t.spawn),structural=createWalkWorld({boundary:t.outer,solids,radius:.07});
  const access=residential?createTerraceAccessGate({boundary:t.outer,solids,obstacles:originalObstacles},originalSpawn):null;
  if(residential){
   // Round white lounge chairs complement the retained sofa groups. Place one
   // only where its complete footprint leaves the original terrace boundary clear.
   for(const item of t.furniture){
    const c=Math.cos(item.angle),s=Math.sin(item.angle),at=(u,v)=>[item.x+c*u+s*v,item.z-s*u+c*v];
    const available=createWalkWorld({boundary:t.outer,solids,obstacles:colliders,radius:.56});
    const point=[[1.28,-.93],[-1.28,-.93],[.94,-1.58]].map(p=>at(...p)).find(p=>available.free(...p)&&(!originalSpawn||Math.hypot(p[0]-originalSpawn.x,p[1]-originalSpawn.z)>1.3)&&access.accept({type:'circle',x:p[0],z:p[1],radius:.47}));if(!point)continue;
    const chair=new THREE.Group();chair.position.set(point[0],t.level+.055,point[1]);chair.rotation.y=item.angle+.36;group.add(chair);
    const profile=[[.31,.11],[.40,.12],[.445,.55],[.42,.65],[.35,.64],[.31,.21],[.31,.11]].map(p=>new THREE.Vector2(...p));
    mesh(new THREE.LatheGeometry(profile,28,-Math.PI*.72,Math.PI*1.44),mats.pot,chair);
    mesh(new THREE.CylinderGeometry(.31,.32,.13,24),mats.fabric,chair).position.y=.25;
    mesh(new THREE.CylinderGeometry(.28,.25,.13,20),mats.pot,chair).position.y=.07;
    const collider={type:'circle',x:point[0],z:point[1],radius:.47,source:'reference-lounge-chair'};colliders.push(collider);chairPlacements.push(collider);
   }
   const furnitureWorld=createWalkWorld({boundary:t.outer,solids,obstacles:colliders,radius:.36});
   const furnitureClearance=createWalkWorld({obstacles:colliders,radius:.45});
   // Low, dense edge planting sits inside the glass. An unobstructed walking
   // probe on its inner side prevents a planter from closing a narrow bypass.
   for(const rail of t.rails)for(const sample of railSamples(rail)){
    const {x,z,tx,tz}=sample;let nx=-tz,nz=tx;
    if(!structural.free(x+nx*.46,z+nz*.46)){nx=-nx;nz=-nz}
    const px=x+nx*.43,pz=z+nz*.43;
    if(Math.hypot(px-t.spawn[0],pz-t.spawn[1])<1.4||(originalSpawn&&Math.hypot(px-originalSpawn.x,pz-originalSpawn.z)<1.4)||!furnitureClearance.free(px,pz)||!furnitureWorld.free(px+nx*.90,pz+nz*.90))continue;
    if(![-.29,0,.29].every(u=>[-.23,0,.23].every(v=>structural.free(px+tx*u+nx*v,pz+tz*u+nz*v))))continue;
    const collider={type:'box',x:px,z:pz,width:.58,depth:.45,angle:-Math.atan2(tz,tx),source:'reference-edge-hedge'};if(!access.accept(collider))continue;
    const planter=box(.575,.27,.42,px,t.level+.055,pz,mats.planter);planter.rotation.y=collider.angle;
    hedgeLeaves.push({x:px,y:t.level+.65,z:pz,angle:collider.angle});
    colliders.push(collider);hedgePlacements.push(collider);
   }
  }
  const world=createWalkWorld({boundary:t.outer,solids,obstacles:colliders}),spawn=world.nearest(t.spawn);if(spawn){worlds.push(world);destinations.push({name:`Терраса ${t.id}`,point:[spawn.x,spawn.z],look:t.look,elevation:t.level+.055,world,terraceIndex:index})}
  referenceDetails.push({terraceIndex:index,id:t.id,residential,deckAngle,originalObstacles,originalSpawn,chairPlacements,hedgePlacements,access:access?.stats});
 }
 const dummy=new THREE.Object3D(),leafMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mats.leaf,leaves.length),grassMesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.035,1,4),mats.grass,blades.length);
 // A single leaf-textured crown per accepted planter overlaps the next along
 // the rail. Its width is smaller than the old three-sphere envelope and its
 // depth stays within the existing planter collision; routes do not change.
 const hedgeGeometry=crownGeometry(1,1,false,0);hedgeGeometry.computeBoundingBox();
 const hedgeCenter=hedgeGeometry.boundingBox.getCenter(new THREE.Vector3()),hedgeSize=hedgeGeometry.boundingBox.getSize(new THREE.Vector3());
 hedgeGeometry.translate(-hedgeCenter.x,-hedgeCenter.y,-hedgeCenter.z);hedgeGeometry.scale(1/hedgeSize.x,1/hedgeSize.y,1/hedgeSize.z);hedgeGeometry.computeBoundingBox();hedgeGeometry.computeBoundingSphere();
 const hedgeMesh=new THREE.InstancedMesh(hedgeGeometry,mats.hedgeLeaf,hedgeLeaves.length),hedgeColor=new THREE.Color();
 hedgeMesh.name='Continuous textured residential terrace hedges';
 hedgeMesh.userData.referenceFoliage={sourceViews:['12.03.36','12.03.39','12.03.41'],canopyMax:[.88,.595,.43],planterSpacing:.56,collisionUnchanged:true};
 hedgeLeaves.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(.84+(i*7%5)*.01,.55+(i%4)*.015,.43);dummy.updateMatrix();hedgeMesh.setMatrixAt(i,dummy.matrix);hedgeMesh.setColorAt(i,hedgeColor.setScalar(.94+(i%5)*.015))});
 leaves.forEach(([x,y,z,s],i)=>{dummy.position.set(x,y,z);dummy.scale.set(s,s*.76,s);dummy.rotation.set(0,0,0);dummy.updateMatrix();leafMesh.setMatrixAt(i,dummy.matrix)});blades.forEach(([x,y,z,h,a],i)=>{dummy.position.set(x,y,z);dummy.scale.set(1,h,1);dummy.rotation.set(Math.sin(a)*.22,a,Math.cos(a)*.22);dummy.updateMatrix();grassMesh.setMatrixAt(i,dummy.matrix)});for(const o of [leafMesh,grassMesh,hedgeMesh]){o.instanceMatrix.needsUpdate=true;group.add(o)}
 // The complete balustrade uses one transparent draw; furniture is batched by material.
 const panes=group.children.filter(o=>o.isMesh&&o.material===mats.glass),length=panes.reduce((n,o)=>n+o.geometry.attributes.position.array.length,0),pos=new Float32Array(length),normal=new Float32Array(length),uv=new Float32Array(length/3*2);let offset=0;
 for(const pane of panes){const g=pane.geometry;pos.set(g.attributes.position.array,offset);normal.set(g.attributes.normal.array,offset);uv.set(g.attributes.uv.array,offset/3*2);offset+=g.attributes.position.array.length;g.dispose();group.remove(pane)}const allGlass=new THREE.BufferGeometry();allGlass.setAttribute('position',new THREE.BufferAttribute(pos,3));allGlass.setAttribute('normal',new THREE.BufferAttribute(normal,3));allGlass.setAttribute('uv',new THREE.BufferAttribute(uv,2));mesh(allGlass,mats.glass).name='Continuous curved glass railings on all second-floor terraces';
 // Batch opaque furniture across nested sofa groups.
 for(const child of [...group.children])if(child.isGroup){child.updateMatrixWorld(true);for(const o of [...child.children]){o.applyMatrix4(child.matrix);group.add(o)}group.remove(child)}batchStatic(group);
 const featured=destinations.find(d=>d.name==='Терраса 2')??destinations[0];
 group.userData.referenceTerraces={sourceViews:['12.03.36','12.03.39','12.03.41'],deck:'dark longitudinal boards on residential terraces only',chairCount:referenceDetails.reduce((n,d)=>n+d.chairPlacements.length,0),hedgeSegments:referenceDetails.reduce((n,d)=>n+d.hedgePlacements.length,0),footprintsUnchanged:true};
 return{group,mats,worlds,destinations,featured,lamps,data:runtimeTerraces,referenceDetails,setNight(n){mats.light.emissiveIntensity=n*1.6},setSeason(winter){mats.leaf.color.set(winter?0x8b947f:0x4b6645);mats.hedgeLeaf.color.set(winter?0x8b947f:0x4b6645);grassMesh.visible=!winter},dispose(){
  root.remove(group);const geometries=new Set(),materials=new Set();
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);if(o.material)for(const material of [o.material].flat())materials.add(material);});
  geometries.forEach(g=>g.dispose());for(const m of Object.values(mats))materials.add(m);disposeOwnedMaterials([...materials]);
 }};
}
