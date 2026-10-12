// Actual-scene gates for the v25 two-storey street and arena capsule.
// Run: node tools/qa/commercial-arena.mjs [--json /absolute/report.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {complexFootprints as footprint} from '../../dist/complex-footprints.js';
import {retailLevels} from '../../dist/frontage-zones.js';

const model=createComplex(),frontage=model.commercialFrontage,arena=model.arenaExterior;
model.root.updateMatrixWorld(true);
const near=(a,b,label,tolerance=.0003)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} versus ${b}`);
const bounds=mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};
const visible=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
const cast=(origin,target)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...target).sub(new THREE.Vector3(...origin)).normalize()).intersectObject(model.root,true).filter(hit=>visible(hit.object));
const results={version:25,datum:'model reconstruction',fullSceneLED:[],fascia:[],roofCrowns:[],disposal:{}};
const disposal=[];
for(const [name,group] of [['commercial',frontage.group],['arena',arena.group]]){
 const unique=new Set();group.traverse(object=>{if(object.geometry)unique.add(object.geometry)});
 for(const geometry of unique){const record={name,disposed:false};geometry.addEventListener('dispose',()=>record.disposed=true);disposal.push(record);}
}
for(const [name,object] of [['shop-atlas',frontage.shopInteriorTexture],['arena-media',arena.arenaMedia.texture],['shop-instance-buffer',frontage.shopWindows]]){
 const record={name,disposed:false};object.addEventListener('dispose',()=>record.disposed=true);disposal.push(record);
}

try{
 // Read real bounding boxes, including the provenance displacement. The dark
 // bodies leave a vertical interval occupied only by the broad white band.
 const fasciaBox=bounds(frontage.divider),lowerBox=bounds(model.pedestal),upperBox=bounds(model.upperPedestal),arenaLower=bounds(arena.arena),arenaUpper=bounds(arena.upperCore);
 near(lowerBox.min.y,0,'Original lower podium starts at ground');near(lowerBox.max.y,retailLevels.dividerBottom,'Dark podium stops below the fascia');
 near(fasciaBox.min.y,retailLevels.dividerBottom,'White fascia bottom');near(fasciaBox.max.y,retailLevels.dividerTop,'White fascia top');
 near(upperBox.min.y,retailLevels.dividerTop,'Upper podium starts above the fascia');near(upperBox.max.y,retailLevels.upperTop,'Upper shop body top');
 near(arenaLower.max.y,retailLevels.dividerBottom,'Circular lower core stops below the same fascia');near(arenaUpper.min.y,retailLevels.dividerTop,'Circular upper core starts above it');
 results.levels={lower:[lowerBox.min.y,lowerBox.max.y],fascia:[fasciaBox.min.y,fasciaBox.max.y],upper:[upperBox.min.y,upperBox.max.y],roof:retailLevels.roof};

 // Every surviving upper bay retains the position and width of its lower bay.
 // Inspect the actual instance transform, so metadata alone cannot satisfy this.
 const lowerById=new Map(frontage.commercialPanes.map(p=>[p.id,p])),instanceMatrix=new THREE.Matrix4();let paired=0;
 for(const pane of frontage.upperCommercialPanes){const lower=lowerById.get(pane.id);assert.ok(lower,'Upper shop belongs to an existing lower bay');for(const key of ['x','z','width','angle'])near(pane[key],lower[key],`Aligned ${key}`,1e-8);assert.ok(pane.height>2&&lower.height>2.8);paired++;}
 assert.ok(paired>100,'The two-storey frontage continues beyond the arena');
 const windowBox=frontage.shopWindows.geometry.boundingBox??(frontage.shopWindows.geometry.computeBoundingBox(),frontage.shopWindows.geometry.boundingBox);
 for(const [index,pane] of frontage.allCommercialPanes.entries()){
  frontage.shopWindows.getMatrixAt(index,instanceMatrix);const box=windowBox.clone().applyMatrix4(instanceMatrix).applyMatrix4(frontage.shopWindows.matrixWorld);
  near(box.min.y,pane.bottom,`Actual window ${index} bottom`);near(box.max.y,pane.top,`Actual window ${index} top`);
 }
 assert.ok(frontage.arenaPanes.every(p=>p.storey===1&&p.top<=retailLevels.dividerBottom),'There is one glazed row below the arena capsule');
 results.windows={pairedUpperBays:paired,lowerBays:frontage.metadata.lowerBays,arenaGroundBays:frontage.arenaPanes.length,renderedInstances:frontage.shopWindows.count};

 // Original bug: the ray reached a second-storey shop, then a podium wall, and
 // only then the screen. This is deliberately a ray through the entire scene.
 const [ax,az]=model.arenaCenter,screen=arena.arenaMedia.mesh;
 for(const y of [4.2,5.5,6.3,6.8]){
  const origin=[-138,y,-42],hits=cast(origin,[ax,y,az]);assert.equal(hits[0]?.object,screen,`Full scene LED visibility at height ${y}`);
  results.fullSceneLED.push({origin,target:[ax,y,az],first:hits[0].object.name,distance:hits[0].distance,point:hits[0].point.toArray(),next:hits[1]?.object.name});
 }
 // Also check nine interior triangles from the actual rendered street camera.
 // Sampling their barycentres avoids numerical ambiguity on a shared edge.
 const positions=screen.geometry.attributes.position,indices=screen.geometry.index.array;
 for(const row of [6,16,26])for(const column of [28,56,84]){
  const at=(row*112+column)*6,target=new THREE.Vector3();for(let i=0;i<3;i++)target.add(new THREE.Vector3().fromBufferAttribute(positions,indices[at+i]));target.multiplyScalar(1/3).applyMatrix4(screen.matrixWorld);
  const origin=[-138,14,-42],hits=cast(origin,target.toArray());assert.equal(hits[0]?.object,screen,`Actual street camera, screen triangle ${row}/${column}`);
  results.fullSceneLED.push({origin,target:target.toArray(),first:hits[0].object.name,distance:hits[0].distance});
 }
 assert.equal(screen.material.side,THREE.FrontSide,'The capsule is outward-facing geometry');

 // Check the previously coincident round flank as well as the straight street.
 // Alpha-tested lettering has no opaque backing; CPU rays do not sample its
 // bitmap alpha, so this band check uses the first opaque surface in the ray.
 const base=arena.arenaMedia.screenProfile.frontAngle;
 for(const delta of [-.45,0,.45,.9,1.05,1.2,1.35,1.5]){
  const theta=base+delta,origin=[ax+Math.sin(theta)*31,3.48,az+Math.cos(theta)*31];
  const hits=cast(origin,[ax,3.48,az]).filter(({object})=>!object.material?.transparent&&!(object.material?.alphaTest>0));
  assert.equal(hits[0]?.object,frontage.divider,`Clean white fascia at arena angle ${delta}`);
  results.fascia.push({origin,angleFromFront:delta,first:hits[0].object.name,distance:hits[0].distance});
 }

 // The upper relief does not alter the ground plan, and it does not intersect
 // any residential or office footprint. Check edge samples, not centres alone.
 const relief=model.upperPedestal.geometry.userData.arenaUpperRelief;
 const inRelief=(x,z)=>{const dx=x-relief.centre[0],dz=z-relief.centre[1],u=dx*relief.tangent[0]+dz*relief.tangent[1],v=dx*relief.normal[0]+dz*relief.normal[1];return Math.abs(u)<relief.halfWidth&&v>relief.back&&v<relief.front;};
 for(const building of footprint.buildings)for(let i=0;i<building.shape.length;i++){
  const a=building.shape[i],b=building.shape[(i+1)%building.shape.length];for(const t of [0,.5,1])assert.equal(inRelief(building.x+a[0]+(b[0]-a[0])*t,building.z+a[1]+(b[1]-a[1])*t),false,`Arena relief stays away from building ${building.id}`);
 }
 assert.ok(relief.removedArea>0&&relief.remainingArea>relief.sourceArea*.8,'Local upper replacement keeps the rest of the commercial roof');
 results.upperRelief={sourceArea:relief.sourceArea,remainingArea:relief.remainingArea,removedArea:relief.removedArea,groundPlanUnchanged:true,buildingFootprintsClear:true};

 // Roof plates have four actual top elevations. A centre ray must hit a solid
 // top, while progressively larger samples land on the three lower steps.
 for(const [id,tower] of model.towers){if(id===0)continue;const crown=tower.group.children.find(o=>o.userData.roofCrown),meta=crown?.userData.roofCrown;assert.ok(crown);
  const edge=tower.shape.getPointAt(.19),heights=[];
  for(let step=0;step<4;step++){
   const scale=step===3?0:(meta.scales[step]+meta.scales[step+1])/2,point=new THREE.Vector3(edge.x*scale,0,-edge.y*scale).applyMatrix4(crown.matrixWorld);
   const ray=new THREE.Raycaster(new THREE.Vector3(point.x,tower.spec.h+5,point.z),new THREE.Vector3(0,-1,0)),hit=ray.intersectObject(crown,true)[0];assert.ok(hit,'Solid roof plate under each ray');
   const expected=tower.spec.h+1.36+step*(meta.plateHeight+meta.shadowGap)+meta.plateHeight;near(hit.point.y,expected,`Tower ${id}, roof step ${step}`);heights.push(hit.point.y);
  }
  results.roofCrowns.push({building:id,actualStepHeights:heights});
 }
}finally{model.dispose();}
for(const record of disposal)assert.ok(record.disposed,`Owned resource disposed: ${record.name}`);
for(const record of disposal)results.disposal[record.name]=(results.disposal[record.name]||0)+1;
const jsonAt=process.argv.indexOf('--json');if(jsonAt>=0){assert.ok(process.argv[jsonAt+1],'JSON destination supplied');fs.writeFileSync(process.argv[jsonAt+1],JSON.stringify(results,null,2)+'\n');}
console.log('PASS: real two-storey shop instances, full-scene LED visibility, clean opaque white fascia, local upper relief, four solid roof steps and owned resource disposal');
console.log(JSON.stringify(results,null,2));
