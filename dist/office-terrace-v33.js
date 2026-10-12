// @r_peredelkino · occupied office podium roof seen in node3 / supplied office views.
// The architectural slab is retained; furniture/plant sizes are visual estimates.
import * as T from './vendor/three.module.js';
import polygonClipping from './vendor/polygon-clipping.module.js';
import {complexFootprints as f} from './complex-footprints.js?v=community38';
import {retailLevels} from './frontage-zones.js?v=community38';
import {createWalkWorld,solidContains,segmentDistance} from './walk-physics.js?v=community38';
import {batchStatic} from './scene-batches.js?v=community38';
import {crownGeometry} from './botanical-geometry.js?v=community38';
import {createFoliageMaterial,createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';
import {applyPaving} from './paving-material.js?v=community38';

const office=f.buildings.find(b=>b.id===0),officeRing=office.shape.map(([x,z])=>[office.x+x,office.z+z]);
// Register the observed occupied wing to the unchanged architectural contours.
// The source panorama's nominal GPS is not survey grade: do not relocate the
// tower to its unregistered image projection or expand this floor off the slab.
const roofWing=[[53,-90],[83,-90],[83,-44],[53,-44]];
export const officeTerraceFootprints=polygonClipping.difference(polygonClipping.intersection([f.podium.outer], [roofWing]), [officeRing]).map(p=>({outer:p[0].slice(0,-1),holes:p.slice(1).map(h=>h.slice(0,-1))}));
const inside=(x,z)=>officeTerraceFootprints.some(p=>solidContains(x,z,p));
export function officeTerraceReserved(x,z,margin=0){return inside(x,z)||margin>0&&officeTerraceFootprints.some(p=>p.outer.some((a,i)=>segmentDistance(x,z,a,p.outer[(i+1)%p.outer.length])<margin));}

export function createOfficeTerrace(root){
 const group=new T.Group();group.name='Planted office terrace above the two retail storeys';root.add(group);
 const level=retailLevels.roof+.065,m={stone:new T.MeshStandardMaterial({color:0xdad6c9,roughness:.87}),white:createMineralMaterial(0xe7e6df,{grain:.025,scale:1.8,name:'Fine mineral restaurant terrace furniture'}),fabric:new T.MeshStandardMaterial({color:0xf0eadb,roughness:.9,side:T.DoubleSide}),wood:new T.MeshStandardMaterial({color:0x948374,roughness:.75}),metal:new T.MeshStandardMaterial({color:0xa0a6a1,metalness:.67,roughness:.30}),glass:new T.MeshStandardMaterial({color:0xcad6d0,metalness:.08,roughness:.18,transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide}),soil:new T.MeshStandardMaterial({color:0x515943,roughness:1}),leaf:createFoliageMaterial(0x4c6a48)};
 // v35 changes only authored surface finishes here. Original v33 furniture
 // anchors, planted boundaries, footpaths and all existing colliders remain.
 const weaveBytes=new Uint8Array(64*64*4),timberBytes=new Uint8Array(64*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,w=((x+y)%3?246:226),g=230+Math.round(Math.sin(y*.85+x*.055)*10);weaveBytes.set([w,w,w,255],i);timberBytes.set([g,g-4,g-10,255],i);}
 function finishMap(bytes,name){const map=new T.DataTexture(bytes,64,64,T.RGBAFormat);map.wrapS=map.wrapT=T.RepeatWrapping;map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.name=name+' · @r_peredelkino';map.needsUpdate=true;return map;}
 m.fabric.map=finishMap(weaveBytes,'Fine woven outdoor linen');m.fabric.bumpMap=m.fabric.map;m.fabric.bumpScale=.002;
 m.wood.map=finishMap(timberBytes,'Warm terrace timber grain');m.wood.bumpMap=m.wood.map;m.wood.bumpScale=.003;
 applyPaving(m.stone);
 const mesh=(g,mat,x=0,y=0,z=0,parent=group)=>{const o=new T.Mesh(g,mat);o.position.set(x,y,z);o.castShadow=!mat.transparent;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,x,y,z,mat,parent=group)=>mesh(new T.BoxGeometry(w,h,d),mat,x,y+h/2,z,parent);
 const worldForPlacement=createWalkWorld({boundary:officeTerraceFootprints[0],boundaryExtensions:officeTerraceFootprints.slice(1),radius:.14});
 const clear=(x,z,r)=>[0,.5,1].every(k=>Array.from({length:16},(_,i)=>i/16*Math.PI*2).every(a=>worldForPlacement.free(x+Math.cos(a)*r*k,z+Math.sin(a)*r*k)));
 for(const p of officeTerraceFootprints){const s=new T.Shape(p.outer.map(([x,z])=>new T.Vector2(x,-z)));for(const h of p.holes)s.holes.push(new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));const g=new T.ExtrudeGeometry(s,{depth:.055,bevelEnabled:false});g.rotateX(-Math.PI/2);mesh(g,m.stone,0,level-.055,0).name='Continuous pale paving on the office terrace';}
 const colliders=[],tables=[],planters=[],trees=[],beds=[];
 const tableSeeds=[[71,-81],[73,-77],[71,-72],[68,-67],[64,-61],[63,-74],[61,-79],[59,-85],[59,-66],[61,-70]];
 for(const [index,[x,z]] of tableSeeds.entries()){
  if(!clear(x,z,1.46)||colliders.some(c=>Math.hypot(x-c.x,z-c.z)<2.8))continue;
  mesh(new T.CylinderGeometry(.45,.45,.045,24),m.white,x,level+.75,z);mesh(new T.CylinderGeometry(.033,.05,.73,10),m.metal,x,level+.365,z);
  colliders.push({type:'circle',x,z,radius:.48,source:'office-terrace-table'});
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2+index*.35,cx=x+Math.cos(a)*.91,cz=z+Math.sin(a)*.91,chair=new T.Group();chair.position.set(cx,level,cz);chair.rotation.y=-a+Math.PI/2;group.add(chair);box(.48,.075,.48,0,.43,0,m.fabric,chair);box(.48,.48,.055,0,.45,.23,m.fabric,chair);for(const sx of [-.19,.19])for(const sz of [-.18,.18])box(.023,.43,.023,sx,0,sz,m.metal,chair);colliders.push({type:'circle',x:cx,z:cz,radius:.31,source:'office-terrace-chair'});}
  if(index%2===0){mesh(new T.CylinderGeometry(.025,.025,2.7,10),m.metal,x,level+1.35,z);const umbrella=mesh(new T.ConeGeometry(1.30,.26,8,1,true),m.fabric,x,level+2.65,z);umbrella.name='Light fabric umbrella on the office rooftop terrace';}
  tables.push({x,z,chairs:3,umbrella:index%2===0});
 }
 // Perimeter trees and low planting retain a continuous clear inner route.
 const seeds=[[74,-82,.47],[73.5,-75,.45],[70.3,-67,.50],[65.9,-60.9,.45],[60,-85,.43],[60.2,-75,.42],[57.8,-69,.42],[61,-62,.40]];
 for(const [i,[x,z,r]] of seeds.entries()){
  if(!clear(x,z,r+.2)||colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.radius+r+.25))continue;
  mesh(new T.CylinderGeometry(r,r*.84,.54,24),m.white,x,level+.27,z);mesh(new T.CylinderGeometry(r*.85,r*.85,.02,20),m.soil,x,level+.52,z);
  mesh(new T.CylinderGeometry(.035,.055,1.5,9),m.wood,x,level+1.22,z);colliders.push({type:'circle',x,z,radius:r,source:'office-terrace-planter'});planters.push({x,z,r});trees.push({x,y:level+2.28,z,r:.71+i%3*.1});
 }
 // Source-visible central planting is separate from the table route.
 const bedOutline=[[66,-80],[69,-78],[71,-75],[69,-68],[64,-65],[62,-67],[64,-70],[66,-75]],bedCuts=tables.map(p=>[Array.from({length:32},(_,i)=>[p.x+Math.cos(i/32*Math.PI*2)*1.72,p.z+Math.sin(i/32*Math.PI*2)*1.72])]);
 const bedParts=polygonClipping.difference(polygonClipping.intersection(officeTerraceFootprints.map(p=>[p.outer,...p.holes]),[bedOutline]),...bedCuts);
 for(const part of bedParts){const p={outer:part[0].slice(0,-1),holes:part.slice(1).map(h=>h.slice(0,-1))};if(Math.abs(p.outer.reduce((a,v,i)=>{const q=p.outer[(i+1)%p.outer.length];return a+v[0]*q[1]-q[0]*v[1];},0))<1)continue;beds.push(p);const shape=new T.Shape(p.outer.map(([x,z])=>new T.Vector2(x,-z)));for(const h of p.holes)shape.holes.push(new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));const g=new T.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false});g.rotateX(-Math.PI/2);mesh(g,m.white,0,level,0);const top=new T.ShapeGeometry(shape);top.rotateX(-Math.PI/2);mesh(top,m.soil,0,level+.356,0);}
 const lowPlants=[];for(let x=62;x<72;x+=.62)for(let z=-80;z<-65;z+=.62)if(beds.some(b=>solidContains(x,z,b)))lowPlants.push({x,z});
 const lowGeometry=crownGeometry(.35,.50,false,0),low=new T.InstancedMesh(lowGeometry,m.leaf,lowPlants.length),lowDummy=new T.Object3D();low.name='Continuous planted border on the office terrace';lowPlants.forEach((p,i)=>{lowDummy.position.set(p.x,level+.49,p.z);lowDummy.rotation.y=i*2.399;lowDummy.updateMatrix();low.setMatrixAt(i,lowDummy.matrix);});low.instanceMatrix.needsUpdate=true;low.castShadow=low.receiveShadow=true;group.add(low);
 const dummy=new T.Object3D(),crowns=new T.InstancedMesh(crownGeometry(1,1.2,false,0),m.leaf,trees.length);crowns.name='Textured trees in office terrace planters';trees.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.r,p.r*.92,p.r);dummy.rotation.y=i*2.399;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);});crowns.instanceMatrix.needsUpdate=true;crowns.castShadow=crowns.receiveShadow=true;group.add(crowns);
 const railVertices=[],railUV=[];
 for(let i=0;i<f.podium.outer.length-1;i++){const a=f.podium.outer[i],b=f.podium.outer[i+1],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(!officeTerraceReserved(...mid,.02)||Math.hypot(b[0]-a[0],b[1]-a[1])<.02)continue;for(const [p,h,u] of [[a,0,0],[b,0,1],[b,1,1],[a,0,0],[b,1,1],[a,1,0]]){railVertices.push(p[0],level+.43+h*.64,p[1]);railUV.push(u,h);}const g=new T.CylinderGeometry(.018,.018,Math.hypot(b[0]-a[0],b[1]-a[1]),6);g.rotateZ(Math.PI/2);g.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0]));mesh(g,m.metal,mid[0],level+1.09,mid[1]);}
 if(railVertices.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(railVertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(railUV,2));g.computeVertexNormals();mesh(g,m.glass).name='Slender glazed edge above the retained office roof parapet';}
 const world=createWalkWorld({boundary:officeTerraceFootprints[0],boundaryExtensions:officeTerraceFootprints.slice(1),obstacles:colliders,solids:beds}),spawn=world.nearest([62,-83]),destination=spawn?{name:'Терраса офиса',point:[spawn.x,spawn.z],look:[75,-77],elevation:level,world}:null;
 for(const child of [...group.children])if(child.isGroup){child.updateMatrixWorld(true);for(const o of [...child.children]){o.applyMatrix4(child.matrix);group.add(o);}group.remove(child);}batchStatic(group);
 const metadata={revision:33,sourceViews:['node3 office, pan -24 / tilt -40 / fov 45','2026-10-11 13.38.16(1)','orig.webp','physical sales-office model'],architecturalFootprintsUnchanged:true,roofWing,level,tables,planters,plantedBeds:beds.length,plantCount:lowPlants.length,dimensionsStatus:'Fitted to the retained model slab; plants/furniture placement and dimensions estimated from renders, not survey data',roofEquipmentExcluded:true};group.userData.reference=metadata;
 metadata.authoredFinishRevision=35;metadata.originalFurnitureAndPlantingAnchorsRetained=true;
 return{group,metadata,destination,world,colliders,beds,materials:m,setSeason(winter){m.leaf.color.set(winter?0x969d91:0x4c6a48);m.stone.color.set(winter?0xe4e8e4:0xdad6c9);},dispose(){root.remove(group);const geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());disposeOwnedMaterials(m);}};
}
