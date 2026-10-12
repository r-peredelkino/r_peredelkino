import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as T from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';

const here=new URL('./',import.meta.url),baseline=JSON.parse(fs.readFileSync(new URL('performance-planting-baseline-v30.json',here),'utf8'));
const hash=value=>crypto.createHash('sha256').update(ArrayBuffer.isView(value)?Buffer.from(value.buffer,value.byteOffset,value.byteLength):JSON.stringify(value)).digest('hex');
const capture=source=>({name:source.name,count:source.count,matrix:hash(source.instanceMatrix.array),colour:source.instanceColor?hash(source.instanceColor.array):null,attributes:Object.fromEntries(Object.entries(source.geometry.attributes).map(([key,value])=>[key,hash(value.array)])),index:source.geometry.index?hash(source.geometry.index.array):null,metadata:hash(source.userData),geometryTriangles:(source.geometry.index?.count??source.geometry.attributes.position.count)/3,cast:source.castShadow,receive:source.receiveShadow});
const started=performance.now(),model=createComplex(),garden=model.publicRealm.forecourt.landscape,realm=model.publicRealm,batches=garden.spatialInstances;
assert.equal(batches.length,3);assert.deepEqual(batches.map(b=>capture(b.source)),baseline.forecourtSources,'All original transforms, colours, geometry and metadata match installed v30');
assert.deepEqual(realm.spatialInstances.map(b=>capture(b.source)),baseline.otherSources,'Other promenade planting is unchanged');
assert.equal(hash(garden.metadata),baseline.sourceMetadata);assert.equal(hash(realm.data),baseline.layout);assert.equal(hash(model.neighborhood.trees),baseline.forestAnchors);

const matrix=new T.Matrix4(),box=new T.Box3(),sphere=new T.Sphere();
function validateBuffers(){
 for(const batch of batches){
  assert.equal(batch.source.parent,null);assert.equal(batch.group.visible,batch.source.visible);assert.equal(batch.chunks.length,batch.lowChunks.length);
  const coverage=new Uint8Array(batch.source.count),rows=new Float32Array(batch.source.count*16),colours=batch.source.instanceColor?new Float32Array(batch.source.count*3):null;
  batch.chunks.forEach((near,i)=>{
   const far=batch.lowChunks[i];assert.strictEqual(near.geometry,batch.source.geometry);assert.strictEqual(far.instanceMatrix,near.instanceMatrix);assert.strictEqual(far.instanceColor,near.instanceColor);
   assert.equal(near.castShadow,batch.source.castShadow);assert.equal(far.castShadow,batch.source.castShadow);assert.equal(near.receiveShadow,true);assert.equal(far.receiveShadow,true);
   for(const geometry of[near.geometry,far.geometry])for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
   near.userData.spatialChunk.sourceIndices.forEach((sourceIndex,local)=>{
    coverage[sourceIndex]++;rows.set(near.instanceMatrix.array.subarray(local*16,local*16+16),sourceIndex*16);if(colours)colours.set(near.instanceColor.array.subarray(local*3,local*3+3),sourceIndex*3);
    near.getMatrixAt(local,matrix);
    for(const geometry of[near.geometry,far.geometry]){
     box.copy(geometry.boundingBox).applyMatrix4(matrix);sphere.copy(geometry.boundingSphere).applyMatrix4(matrix);
     assert.ok(near.boundingBox.containsBox(box),'Bounds contain both entire plant variants');assert.ok(near.boundingSphere.center.distanceTo(sphere.center)+sphere.radius<=near.boundingSphere.radius+1e-5);
    }
   });
  });
  assert.ok(coverage.every(v=>v===1),'Every anchor is represented once per level');assert.equal(hash(rows),hash(batch.source.instanceMatrix.array));if(colours)assert.equal(hash(colours),hash(batch.source.instanceColor.array));
 }
}
validateBuffers();
const originalMatrices=batches.map(b=>hash(b.source.instanceMatrix.array));
realm.setSeason(true,0);validateBuffers();assert.equal(batches[1].group.visible,false);assert.equal(batches[2].group.visible,false);
realm.setSeason(false,6);validateBuffers();assert.deepEqual(batches.map(b=>hash(b.source.instanceMatrix.array)),originalMatrices);assert.ok(batches.every(b=>b.group.visible));
model.root.updateMatrixWorld(true);
const camera=new T.PerspectiveCamera(60,1.5,.1,3500);
function place(position,target=position.map((v,i)=>v+(i===2?-1:0))){camera.position.fromArray(position);camera.lookAt(...target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);batches.forEach(b=>b.updateLOD(camera));}
place([1000,500,1000]);
for(const batch of batches){assert.ok(batch.chunks.every(m=>!m.visible),'Full-detail geometry is excluded at distance');assert.ok(batch.lowChunks.every(m=>m.visible));assert.ok(batch.lowChunks.every(m=>m.material===batch.source.material),'Far endpoints use unchanged source material');}
for(const batch of batches){
 const first=batch.chunks[0],center=first.boundingBox.getCenter(new T.Vector3());place([center.x,1.65,center.z]);
 assert.equal(first.visible,true);assert.equal(batch.lowChunks[0].visible,false);assert.strictEqual(first.material,batch.source.material);assert.strictEqual(first.geometry,batch.source.geometry);
 // Deliberately cross the first cell's transition in small steps. Selection is
 // solely geometric, stable on repeated frames, and uses matching depth masks.
 const {distance,fade}=batch.group.userData.decorativePlantingLOD,coverages=[];
 for(let step=0;step<=32;step++){
  const z=first.boundingBox.max.z+distance-fade/2+fade*step/32;
  place([center.x,center.y,z]);const state=batch.getDetail().cells[0];coverages.push(state.nearCoverage);
  batch.updateLOD(camera);assert.equal(batch.getDetail().cells[0].nearCoverage,state.nearCoverage,'No temporal randomness');
  assert.ok(state.nearVisible||state.farVisible,'Transition never removes a plant cell');
  if(state.nearCoverage>0&&state.nearCoverage<1){
   const nearShader={uniforms:{},fragmentShader:'#include <alphatest_fragment>'},farShader={uniforms:{},fragmentShader:'#include <alphatest_fragment>'};
   first.material.onBeforeCompile(nearShader,null);batch.lowChunks[0].material.onBeforeCompile(farShader,null);
   assert.strictEqual(nearShader.uniforms.plantingLODNearCoverage,farShader.uniforms.plantingLODNearCoverage);assert.equal(nearShader.uniforms.plantingLODIsNear.value,1);assert.equal(farShader.uniforms.plantingLODIsNear.value,0);
   if(first.castShadow){
    assert.ok(first.customDepthMaterial);const shadow={uniforms:{},fragmentShader:'#include <alphatest_fragment>'};first.customDepthMaterial.onBeforeCompile(shadow,null);assert.strictEqual(shadow.uniforms.plantingLODNearCoverage,nearShader.uniforms.plantingLODNearCoverage);
   }
  }
 }
 assert.equal(coverages[0],1);assert.ok(coverages.at(-1)<1e-12);assert.ok(coverages.every((v,i)=>i===0||v<=coverages[i-1]));
}

const cameras={
 'forecourt-source-day':{position:[-88.38121210004893,54.055899587602426,-74.43182231121628],target:[-9.88329,0,-90.57749],fov:39.563767569092846,aspect:1700/1200},
 'arena-source-matched':{position:[-88.38121210004893,54.055899587602426,-74.43182231121628],target:[-64.291,0,-6.86323],fov:42.73852457859029,aspect:1700/1200},
 'promenade-eye':{position:[14,1.68,-102],target:[3,1.68,-86],fov:60,aspect:1.5}
};
const culling={};
function countVisible(frustum){let triangles=0,shadowTriangles=0,draws=0,sourceInstances=0;for(const batch of batches)for(const mesh of[...batch.chunks,...batch.lowChunks])if(mesh.visible&&frustum.intersectsObject(mesh)){
 const value=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*mesh.count;triangles+=value;draws++;sourceInstances+=mesh.count;if(mesh.castShadow)shadowTriangles+=value;
}return{triangles,draws,sourceInstances,shadowEligibleTrianglesInMainFrustum:shadowTriangles};}
for(const [name,spec]of Object.entries(cameras)){
 camera.fov=spec.fov;camera.aspect=spec.aspect;place(spec.position,spec.target);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 batches.forEach(b=>b.setDetail('full'));const full=countVisible(frustum);batches.forEach(b=>b.setDetail('auto'));batches.forEach(b=>b.updateLOD(camera));const automatic=countVisible(frustum);
 assert.ok(automatic.triangles<full.triangles,`${name}: selected draw geometry is reduced`);culling[name]={full,automatic,reduction:1-automatic.triangles/full.triangles,states:batches.map(b=>({name:b.source.name,...b.getDetail()}))};
}
camera.fov=12;place(cameras['promenade-eye'].position,cameras['promenade-eye'].target);assert.ok(batches.some(b=>b.chunks.some(m=>m.visible)),'Optical zoom retains original detail');
batches.forEach(b=>b.setDetail('full'));assert.ok(batches.every(b=>b.chunks.every(m=>m.visible)&&b.lowChunks.every(m=>!m.visible)));
assert.deepEqual(batches.map(b=>capture(b.source)),baseline.forecourtSources,'QA and LOD switches do not mutate source data');
const instanceMeshes=batches.flatMap(b=>[b.source,...b.chunks,...b.lowChunks]),disposals=new Map(instanceMeshes.map(m=>[m,0]));for(const m of instanceMeshes)m.addEventListener('dispose',()=>disposals.set(m,disposals.get(m)+1));
model.dispose();for(const [m,count]of disposals)assert.equal(count,1,`Owned instance released once: ${m.name}`);
const report={pass:true,scope:'Three traced forecourt planting groups only',elapsedMS:performance.now()-started,sourceInstances:baseline.forecourtSources.reduce((n,s)=>n+s.count,0),preservedSourceHashes:baseline.forecourtSources,checks:['Original Float32 transforms, colours, geometry, metadata and footprint anchors match v30','Other promenade sources and all forest anchors are unchanged','Near and far meshes share source instance buffers; every anchor occurs once per level','Both complete transformed geometries lie inside the same conservative bounds','Original near geometry/material and selected far-only draws','Stable complementary colour/depth transition with no frame-random input','Seasonal hide/show and original summer matrix restoration','Optical zoom and full-detail QA override','Each owned instance object is disposed once'],cullingEstimateOnly:culling,gpuTiming:'Not measured here. CPU frustum counts and shadow eligibility are not GPU frame time or FPS.'};
fs.writeFileSync(new URL('performance-planting-check.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,sourceInstances:report.sourceInstances,culling:Object.fromEntries(Object.entries(culling).map(([key,v])=>[key,{full:v.full.triangles,automatic:v.automatic.triangles,reduction:v.reduction,draws:v.automatic.draws}]))},null,2));
