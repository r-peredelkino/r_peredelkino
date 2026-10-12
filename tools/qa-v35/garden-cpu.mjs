// @r_peredelkino · repeatable full-model planting, animation and circulation QA.
// RP_QA_OUT=/tmp/rodina-qa-v35 node tools/qa-v35/garden-cpu.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const url=name=>pathToFileURL(path.join(project,'dist',name)).href;
const T=await import(url('vendor/three.module.js'));
const {createComplex}=await import(url('complex-model.js'));
const {attachCyberExperience}=await import(url('cyber-experience.js'));
const {createTourWorld}=await import(url('walking-tour.js'));
const {solidContains,segmentDistance}=await import(url('walk-physics.js'));
const checks=[],check=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const model=createComplex();
const original={islands:JSON.stringify(model.courtyard.data.islands),paths:JSON.stringify(model.courtyard.data.paths),courtyardColliders:JSON.stringify(model.courtyard.colliders),tables:JSON.stringify(model.officeTerrace.metadata.tables),officeObstacles:JSON.stringify(model.officeTerrace.world.obstacles)};
attachCyberExperience(model);
const garden=model.cyberGarden,restaurant=garden.restaurant,world=createTourWorld(model),matrix=new T.Matrix4(),vertex=new T.Vector3();
check('Garden defaults are calm, intensity .7 and filtered shade .55',garden.state.mode==='calm'&&garden.state.intensity===.7&&garden.state.shade===.55,{state:garden.state});
check('Source planted islands and garden paths retain every original coordinate',JSON.stringify(model.courtyard.data.islands)===original.islands&&JSON.stringify(model.courtyard.data.paths)===original.paths&&garden.metadata.referenceIslandsByteEquivalent);
check('Source courtyard colliders are unchanged',JSON.stringify(model.courtyard.colliders)===original.courtyardColliders);
check('Original five tables, fifteen chairs and three umbrellas remain',JSON.stringify(model.officeTerrace.metadata.tables)===original.tables&&restaurant.metadata.originalTableCount===5&&restaurant.metadata.originalChairCount===15&&restaurant.metadata.originalUmbrellaCount===3);
const roofSource=model.officeTerrace.world.obstacles.filter(o=>!restaurant.obstacles.includes(o));
check('Roof obstacles preserve their originals and add only four shared shade columns',JSON.stringify(roofSource)===original.officeObstacles&&restaurant.obstacles.length===4&&restaurant.obstacles.every(o=>model.officeTerrace.world.obstacles.includes(o)));
check('All six previous authored courtyard objects still exist',model.cyberCourtyard.interactions.length===6&&model.cyberCourtyard.metadata.skipped.length===0,{ids:model.cyberCourtyard.interactions.map(i=>i.id),skipped:model.cyberCourtyard.metadata.skipped});
check('Art and restaurant have all three interactions and no rejected placements',garden.interactions.length===3&&garden.metadata.skipped.length===0&&restaurant.metadata.skipped.length===0,{ids:garden.interactions.map(i=>i.id)});
check('Plant palettes are batched in four rooted formations',garden.metadata.plantCount===457&&Object.values(garden.metadata.plantsByType).reduce((n,x)=>n+x,0)===457,{plantCount:garden.metadata.plantCount,plantsByType:garden.metadata.plantsByType});
let plantedVertices=0,plantOutside=0,rootOutside=0,windEnvelopeOutside=0,minEnvelopeMargin=Infinity;
for(const mesh of garden.group.children.filter(o=>o.isInstancedMesh&&o.name.startsWith('Authored layered planting'))){
 const p=mesh.geometry.attributes.position,kind=mesh.name.split(' · ')[1],formationRoots=garden.metadata.plantedFormations.filter(f=>f.type===kind).flatMap(f=>f.points.map(point=>({point,islandId:f.islandId,islandIndex:f.islandIndex})));
 let trueRadius=0,height=0;
 for(let j=0;j<p.count;j++){trueRadius=Math.max(trueRadius,Math.hypot(p.getX(j),p.getZ(j)));height=Math.max(height,Math.abs(p.getY(j)));}
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);
  // Source islands can overlap. Bind the instance to its actual formation,
  // instead of accidentally checking it against the first neighbouring bed.
  const island=model.courtyard.data.islands[formationRoots[i]?.islandIndex],x=matrix.elements[12],z=matrix.elements[14];
  if(!island||!solidContains(x,z,island)){rootOutside++;continue;}
  let edgeDistance=Infinity;for(const ring of [island.outer,...island.holes||[]])for(let j=0;j<ring.length;j++)edgeDistance=Math.min(edgeDistance,segmentDistance(x,z,ring[j],ring[(j+1)%ring.length]));
  const envelope=Math.hypot(matrix.elements[0],matrix.elements[2])*(trueRadius+.08*height*height),margin=edgeDistance-envelope;
  minEnvelopeMargin=Math.min(minEnvelopeMargin,margin);if(margin<-.00001)windEnvelopeOutside++;
  for(let j=0;j<p.count;j++){vertex.fromBufferAttribute(p,j).applyMatrix4(matrix);plantedVertices++;if(!solidContains(vertex.x,vertex.z,island))plantOutside++;}
 }
}
check('Every actual transformed ground-plant vertex stays inside its source island',plantedVertices>200000&&plantOutside===0&&rootOutside===0,{vertices:plantedVertices,outsideVertices:plantOutside,outsideRoots:rootOutside});
check('Whole plant envelopes and maximum shader breeze fit their true source boundaries',windEnvelopeOutside===0&&garden.metadata.exactPerimeterGuard,{outsideEnvelopes:windEnvelopeOutside,minEnvelopeMargin,radiallyClampedClumps:garden.metadata.clampedClumps});
let roofVertices=0,roofOutside=0;
const flowers=restaurant.group.children.find(o=>o.name.startsWith('Authorial terrace perennials'));
for(let i=0;i<flowers.count;i++){
 flowers.getMatrixAt(i,matrix);
 const bed=model.officeTerrace.beds.find(s=>solidContains(matrix.elements[12],matrix.elements[14],s));
 if(!bed){roofOutside++;continue;}
 for(let j=0;j<flowers.geometry.attributes.position.count;j++){vertex.fromBufferAttribute(flowers.geometry.attributes.position,j).applyMatrix4(matrix);roofVertices++;if(!solidContains(vertex.x,vertex.z,bed))roofOutside++;}
}
check('All 57 terrace perennials and their true geometry remain in the existing bed',flowers.count===57&&roofOutside===0,{clumps:flowers.count,vertices:roofVertices,outsideVertices:roofOutside});
let finiteErrors=0,unmarkedGeometry=0,unmarkedMaterials=0,meshCount=0;
for(const group of [garden.group,restaurant.group])group.traverse(o=>{
 if(!o.geometry)return;meshCount++;
 for(const name of ['position','normal'])if(Array.from(o.geometry.attributes[name]?.array||[]).some(n=>!Number.isFinite(n)))finiteErrors++;
 if(!o.geometry.attributes.rpAuthor||!o.geometry.userData.pixelProvenance)unmarkedGeometry++;
 for(const material of Array.isArray(o.material)?o.material:[o.material])if(!material.userData.attribution||!material.userData.bakedAuthorship)unmarkedMaterials++;
});
check('All new geometry has finite positions and normals',finiteErrors===0,{meshes:meshCount,errors:finiteErrors});
check('Authored geometry and materials carry project provenance',unmarkedGeometry===0&&unmarkedMaterials===0,{unmarkedGeometry,unmarkedMaterials});
check('New static work uses nine garden and six restaurant meshes',garden.metadata.meshCount===9&&restaurant.metadata.meshCount===6,{gardenMeshes:garden.metadata.meshCount,restaurantMeshes:restaurant.metadata.meshCount});
check('Restaurant shade has twenty louvers and a compact retained-floor footprint',restaurant.metadata.shade?.louvers===20&&JSON.stringify(restaurant.metadata.shade.footprint)===JSON.stringify([3.16,3.16]),{shade:restaurant.metadata.shade});
function reachable(actualWorld,start,targets,step,bounds){
 const origin=actualWorld.nearest(start),queue=origin?[origin]:[],seen=new Set(),found={};
 const key=(x,z)=>Math.round(x/step)+','+Math.round(z/step);
 if(origin)seen.add(key(origin.x,origin.z));
 for(let head=0;head<queue.length&&head<20000;head++){
  const p=queue[head];
  for(const target of targets)if(!found[target.id]&&Math.hypot(p.x-target.point[0],p.z-target.point[1])<step*1.65){
   const next=actualWorld.move(p,target.point[0]-p.x,target.point[1]-p.z);
   if(Math.hypot(next.x-target.point[0],next.z-target.point[1])<.0001)found[target.id]=true;
  }
  if(targets.every(t=>found[t.id]))break;
  for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){
   const x=p.x+dx,z=p.z+dz,k=key(x,z);
   if(x<bounds[0]||x>bounds[1]||z<bounds[2]||z>bounds[3]||seen.has(k)||!actualWorld.free(x,z))continue;
   seen.add(k);const next=actualWorld.move(p,dx,dz);
   if(Math.hypot(next.x-x,next.z-z)>.0001)continue;queue.push({x,z});
  }
 }
 return{origin,visited:queue.length,reachable:found,all:targets.every(t=>found[t.id])};
}
const ground=[...model.cyberCourtyard.interactions,...garden.interactions.filter(i=>!i.world)],roof=garden.interactions.filter(i=>i.world);
check('All six previous approaches and the new art approach are free',ground.length===7&&ground.every(i=>world.free(...i.point)),{free:ground.map(i=>({id:i.id,free:world.free(...i.point)}))});
const groundBFS=reachable(world,[6,8],ground,1,[-120,54,-90,55]);
check('Physical pedestrian circulation reaches all seven ground approaches',groundBFS.all,groundBFS);
check('Both restaurant approaches are clear in the actual elevated world',roof.length===2&&roof.every(i=>i.world===model.officeTerrace.world&&i.world.free(...i.point)&&i.elevation===6.705&&i.layer==='garden'));
const roofBFS=reachable(model.officeTerrace.world,model.officeTerrace.destination.point,roof,.25,[55,82,-92,-61]);
check('The office-terrace route reaches both restaurant approaches',roofBFS.all,roofBFS);
check('Dining seat retains an original chair at the elevated seat height',roof.find(i=>i.type==='seat')?.seatHeight===7.155&&Math.abs(Math.hypot(...roof.find(i=>i.type==='seat').seatPoint.map((x,i)=>x-restaurant.metadata.shade.center[i]))-.91)<1e-8);
const petals=garden.group.children.find(o=>o.name.startsWith('Kinetic garden flower')),louvers=restaurant.group.children.find(o=>o.name.includes('twenty batched louvers')),lights=garden.group.children.find(o=>o.name.startsWith('Nine restrained'));
const matrixArray=mesh=>{mesh.getMatrixAt(0,matrix);return matrix.elements.slice();};
garden.setMode('calm');garden.setIntensity(.1);garden.update(2,{night:1});const calm=matrixArray(petals),low=lights.material.emissiveIntensity;
garden.setMode('social');garden.setIntensity(1);garden.update(2,{night:1});const social=matrixArray(petals),high=lights.material.emissiveIntensity;
check('Changing art mode changes real instance matrices and light intensity',calm.some((x,i)=>Math.abs(x-social[i])>.0001)&&high>low*5,{lowIntensity:low,highIntensity:high});
garden.setMode('pulse');garden.update(4,{night:1});const pulse=matrixArray(petals);garden.update(5,{night:1});
check('Pulse mode animates the actual petals over time',pulse.some((x,i)=>Math.abs(x-matrixArray(petals)[i])>.0001));
garden.setShade(0);for(let i=0;i<100;i++)garden.update(6+i*.1);const open=matrixArray(louvers);
garden.setShade(1);for(let i=0;i<100;i++)garden.update(16+i*.1);const closed=matrixArray(louvers);
check('Shade opening and closing moves the twenty real louvers',open.some((x,i)=>Math.abs(x-closed[i])>.01)&&garden.state.shade===1);
const artPoint=garden.metadata.artPlacement.point,beforeHidden=matrixArray(petals),beforeShade=matrixArray(louvers);
garden.setVisible(false);garden.update(80,{night:1});
check('Disabling the authored layer hides it and releases only its new colliders',!garden.group.visible&&!restaurant.group.visible&&[...garden.obstacles,...restaurant.obstacles].every(o=>o.enabled===false)&&world.free(...artPoint)&&roofSource.every(o=>o.enabled!==false));
check('Hidden layers stop their CPU matrix updates',beforeHidden.every((x,i)=>x===matrixArray(petals)[i])&&beforeShade.every((x,i)=>x===matrixArray(louvers)[i]));
garden.setVisible(true);
check('Re-enabling the authored layer restores its shared collider references',[...garden.obstacles,...restaurant.obstacles].every(o=>o.enabled===true)&&!world.free(...artPoint));
const shader={uniforms:{},vertexShader:'#include <begin_vertex>'};garden.group.children.find(o=>o.name==='Authored layered planting · grass').material.onBeforeCompile(shader);
garden.update(81,{wind:.6});
check('Rooted GPU breeze has guarded instancing and live time/wind uniforms',shader.vertexShader.includes('#ifdef USE_INSTANCING')&&shader.vertexShader.includes('position.y*position.y')&&shader.uniforms.uGardenTime.value===81&&shader.uniforms.uGardenBreeze.value===.6);
garden.setMode('calm');garden.setIntensity(.7);garden.setShade(.55);
const result={revision:35,pass:checks.every(c=>c.pass),checkCount:checks.length,checks};
const out=process.env.RP_QA_OUT||path.join(project,'tools','qa-v35');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'garden-cpu.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));model.dispose();if(!result.pass)process.exitCode=1;
