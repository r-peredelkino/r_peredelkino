import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';

const directory=fileURLToPath(new URL('./',import.meta.url));
const before=JSON.parse(fs.readFileSync(`${directory}/spatial-planting-baseline-v30.json`,'utf8'));
const hash=value=>crypto.createHash('sha256').update(ArrayBuffer.isView(value)?Buffer.from(value.buffer,value.byteOffset,value.byteLength):JSON.stringify(value)).digest('hex');
const capture=source=>({name:source.name,count:source.count,matrix:hash(source.instanceMatrix.array),colour:source.instanceColor?hash(source.instanceColor.array):null,attributes:Object.fromEntries(Object.entries(source.geometry.attributes).map(([key,value])=>[key,hash(value.array)])),index:source.geometry.index?hash(source.geometry.index.array):null,metadata:hash(source.userData),geometryTriangles:(source.geometry.index?.count??source.geometry.attributes.position.count)/3,cast:source.castShadow,receive:source.receiveShadow});
const start=performance.now(),model=createComplex(),garden=model.publicRealm.forecourt.landscape,realm=model.publicRealm;
const batches=[...garden.spatialInstances,...realm.spatialInstances];
assert.equal(batches.length,6);
const after=batches.map(batch=>capture(batch.source));
for(let i=0;i<after.length;i++){
 const expected={...before.sources[i],cast:i===1||i===3?false:before.sources[i].cast};
 assert.deepEqual(after[i],expected,`Source batch ${i} retains all original Float32 geometry, transforms, colours and metadata`);
}
assert.deepEqual(capture(garden.flowers.red),{...before.red,cast:false});
assert.equal(hash(garden.metadata),before.sourceMetadata);assert.equal(hash(realm.data),before.layout);assert.equal(hash(model.neighborhood.trees),before.treeAnchors);
function sceneTotals(){const value={instancedCount:0,triangleCount:0,visibleTriangleCount:0};model.root.traverse(object=>{if(!object.isMesh)return;value.triangleCount+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);if(object.isInstancedMesh)value.instancedCount+=object.count;});model.root.traverseVisible(object=>{if(object.isMesh)value.visibleTriangleCount+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);});return value;}
const total=sceneTotals();for(const [key,value]of Object.entries(total))assert.equal(value,before[key],`${key}: no plants or visible surface removed`);
const matrix=new T.Matrix4(),sphere=new T.Sphere(),box=new T.Box3();
function checkPartitions(){
 for(const batch of batches){
  const source=batch.source,matrixRows=new Float32Array(source.count*16),colours=source.instanceColor?new Float32Array(source.count*3):null,coverage=new Uint8Array(source.count);
  assert.equal(batch.group.visible,source.visible);assert.ok(!source.parent,'Original is retained as CPU data, without a duplicate render');
  for(const chunk of batch.chunks){
   assert.strictEqual(chunk.geometry,source.geometry);assert.strictEqual(chunk.material,source.material);assert.equal(chunk.castShadow,source.castShadow);assert.equal(chunk.receiveShadow,source.receiveShadow);
   chunk.userData.spatialChunk.sourceIndices.forEach((index,local)=>{
    coverage[index]++;matrixRows.set(chunk.instanceMatrix.array.subarray(local*16,local*16+16),index*16);if(colours)colours.set(chunk.instanceColor.array.subarray(local*3,local*3+3),index*3);
    chunk.getMatrixAt(local,matrix);sphere.copy(source.geometry.boundingSphere).applyMatrix4(matrix);box.copy(source.geometry.boundingBox).applyMatrix4(matrix);
    assert.ok(chunk.boundingSphere.center.distanceTo(sphere.center)+sphere.radius<=chunk.boundingSphere.radius+1e-7,'Whole transformed crown/sprig lies inside conservative cell sphere');
    assert.ok(chunk.boundingBox.containsBox(box),'Whole transformed geometry lies inside conservative cell box');
   });
  }
  assert.ok(coverage.every(value=>value===1),'Every source instance occurs once');assert.equal(hash(matrixRows),hash(source.instanceMatrix.array));if(colours)assert.equal(hash(colours),hash(source.instanceColor.array));
 }
}
checkPartitions();
const originalMatrices=batches.map(batch=>hash(batch.source.instanceMatrix.array));
realm.setSeason(true,0);checkPartitions();assert.equal(garden.flowers.cream.visible,false);assert.equal(garden.flowers.red.visible,false);assert.equal(realm.spatialInstances[1].group.visible,false);
realm.setSeason(false,6);checkPartitions();assert.deepEqual(batches.map(batch=>hash(batch.source.instanceMatrix.array)),originalMatrices);assert.deepEqual(sceneTotals(),total);
const cameras={
 'promenade-eye':{position:[14,1.68,-102],target:[3,1.68,-86],fov:60,aspect:1.5},
 'forecourt-source-day':{position:[-88.38121210004893,54.055899587602426,-74.43182231121628],target:[-9.88329,0,-90.57749],fov:39.563767569092846,aspect:1700/1200},
 'arena-source-matched':{position:[-88.38121210004893,54.055899587602426,-74.43182231121628],target:[-64.291,0,-6.86323],fov:42.73852457859029,aspect:1700/1200}
};
model.root.updateMatrixWorld(true);
const culling={};
for(const [name,spec]of Object.entries(cameras)){
 const camera=new T.PerspectiveCamera(spec.fov,spec.aspect,.1,3500);camera.position.fromArray(spec.position);camera.lookAt(...spec.target);camera.updateMatrixWorld(true);
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const rows=batches.map(batch=>{const source=batch.source;source.computeBoundingSphere();source.matrixWorld.copy(batch.group.matrixWorld);const per=(source.geometry.index?.count??source.geometry.attributes.position.count)/3;const seen=batch.chunks.filter(chunk=>frustum.intersectsObject(chunk));return{name:source.name||'Promenade tree crowns',before:frustum.intersectsObject(source)?per*source.count:0,after:seen.reduce((n,chunk)=>n+chunk.count*per,0),visibleDraws:seen.length,totalChunks:batch.chunks.length};});
 culling[name]={before:rows.reduce((n,row)=>n+row.before,0),after:rows.reduce((n,row)=>n+row.after,0),visibleDraws:rows.reduce((n,row)=>n+row.visibleDraws,0),rows};
}
const ownedInstances=[...batches.flatMap(batch=>[batch.source,...batch.chunks])],disposal=new Map(ownedInstances.map(mesh=>[mesh,0]));
for(const mesh of ownedInstances)mesh.addEventListener('dispose',()=>disposal.set(mesh,disposal.get(mesh)+1));
model.dispose();for(const [mesh,count]of disposal)assert.equal(count,1,`${mesh.name}: instance buffer released exactly once`);
const report={pass:true,constructionAndChecksMS:performance.now()-start,sourceGroups:6,renderChunks:batches.reduce((n,batch)=>n+batch.chunks.length,0),sourceInstances:batches.reduce((n,batch)=>n+batch.source.count,0),exactSourceHashes:after,total,removedTinyFlowerShadowTriangles:before.sources[1].count*before.sources[1].geometryTriangles+before.sources[3].count*before.sources[3].geometryTriangles+before.red.count*before.red.geometryTriangles,checks:['byte-identical source and rendered transforms/colours','identical geometry and shared materials','every source index rendered exactly once','complete transformed geometry enclosed in each cell bounds','source metadata, layout and all forest anchors unchanged','summer/winter visibility and summer transform restoration','unchanged total geometry and instance counts','all detached and visible instance buffers disposed once'],cullingEstimateOnly:culling,gpuTiming:'Pending actual Mac measurements; CPU frustum counts are not a frame-rate claim'};
fs.writeFileSync(`${directory}/spatial-planting-check-v30.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,sourceGroups:report.sourceGroups,renderChunks:report.renderChunks,sourceInstances:report.sourceInstances,removedTinyFlowerShadowTriangles:report.removedTinyFlowerShadowTriangles,total,culling:Object.fromEntries(Object.entries(culling).map(([key,value])=>[key,{before:value.before,after:value.after,visibleDraws:value.visibleDraws}]))},null,2));
