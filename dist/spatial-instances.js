// Split a static planting batch into independently culled spatial cells.
// The detached source retains its original instance API for seasonal updates.
// Visible chunks share the source geometry/material and copy Float32 data exactly.
import * as THREE from './vendor/three.module.js';
import {attribution} from './attribution.js?v=references37';
import {stampGeometry} from './baked-authorship.js?v=references37';

// The ordered mask has no clock, frame number or stochastic temporal noise.
// Near/far fragments are complementary in both colour and shadow passes.
const ditherHeader=`
uniform float plantingLODNearCoverage;
uniform float plantingLODIsNear;
float plantingLODThreshold(vec2 pixel){
 vec2 p=mod(floor(pixel),4.0),lo=mod(p,2.0),hi=floor(p/2.0);
 float a=2.0*lo.x+3.0*lo.y-4.0*lo.x*lo.y;
 float b=2.0*hi.x+3.0*hi.y-4.0*hi.x*hi.y;
 return (4.0*a+b+0.5)/16.0;
}
`;
const ditherBody=`
float plantingLODMask=plantingLODThreshold(gl_FragCoord.xy);
if(plantingLODIsNear>0.5){if(plantingLODMask>=plantingLODNearCoverage)discard;}
else{if(plantingLODMask<plantingLODNearCoverage)discard;}
`;
function ditherMaterial(material,coverage,isNear){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.plantingLODNearCoverage=coverage;shader.uniforms.plantingLODIsNear={value:isNear?1:0};
  shader.fragmentShader=ditherHeader+shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\n${ditherBody}`);
 };
 material.customProgramCacheKey=()=>`planting-spatial-lod-ordered-v31-${material.type}`;
 material.userData={...material.userData,decorativePlantingLOD:true,temporalNoise:false};return material;
}

export function spatiallyPartitionInstances(source,{cellSize=20,lod=null}={}){
 if(!source?.isInstancedMesh||!source.parent)throw new TypeError('Spatial planting requires an attached InstancedMesh');
 if(!Number.isFinite(cellSize)||cellSize<=0)throw new TypeError('Spatial planting cell size must be positive');
 if(lod&&(!lod.geometry?.isBufferGeometry||!(lod.distance>0)||!(lod.fade>0)||lod.fade>lod.distance*2))throw new TypeError('Planting LOD requires reduced geometry and a positive distance/fade band');
 if(lod&&Array.isArray(source.material))throw new TypeError('Planting LOD requires a single source material');
 if(lod)stampGeometry(lod.geometry,{label:`planting-lod/${source.name}`});
 if(source.morphTexture)throw new TypeError('Morph instances need their own spatial attribute mapping');
 for(const attribute of Object.values(source.geometry.attributes))if(attribute.isInstancedBufferAttribute)throw new TypeError('Geometry instance attributes need their own spatial mapping');
 // Scene attribution is normally attached by its final traversal. The retained
 // CPU source is detached before that traversal, so preserve the same record.
 source.userData.attribution??={...attribution};
 const parent=source.parent,sourceCount=source.count,cells=new Map(),matrix=new THREE.Matrix4();
 for(let index=0;index<sourceCount;index++){
  source.getMatrixAt(index,matrix);
  const x=Math.floor(matrix.elements[12]/cellSize),z=Math.floor(matrix.elements[14]/cellSize),key=`${x},${z}`;
  let cell=cells.get(key);if(!cell){cell={key,x,z,indices:[]};cells.set(key,cell);}cell.indices.push(index);
 }
 // Three calls LOD.update(camera) while building the render list, before it
 // renders shadows. Unselected detailed meshes never enter either draw pass.
 const group=lod?new THREE.LOD():new THREE.Group();group.name=source.name||'Spatially bounded promenade tree crowns';group.matrixAutoUpdate=false;
 if(lod)group.raycast=()=>{}; // Individual child meshes retain ordinary raycasting.
 group.userData={...source.userData,spatialInstances:{cellSize,sourceCount,chunks:cells.size},...(lod?{decorativePlantingLOD:{distance:lod.distance,fade:lod.fade,closeGeometry:'unchanged',sourceCount}}:{})};
 const chunks=[],lowChunks=[],pairs=[],fadeMaterials=new Set();
 for(const cell of cells.values()){
  const mesh=new THREE.InstancedMesh(source.geometry,source.material,cell.indices.length);
  mesh.name=`${source.name||'Promenade tree crowns'} · cell ${cell.key}`;
  mesh.instanceMatrix.setUsage(source.instanceMatrix.usage);
  if(source.instanceColor)mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cell.indices.length*3),3,source.instanceColor.normalized).setUsage(source.instanceColor.usage);
  mesh.userData={...source.userData,spatialChunk:{cellSize,x:cell.x,z:cell.z,sourceCount,sourceIndices:cell.indices}};
  mesh.frustumCulled=source.frustumCulled;mesh.customDepthMaterial=source.customDepthMaterial;mesh.customDistanceMaterial=source.customDistanceMaterial;
  chunks.push(mesh);group.add(mesh);
  if(lod){
   const low=new THREE.InstancedMesh(lod.geometry,source.material,cell.indices.length);
   low.name=`${mesh.name} · distant tessellation`;low.instanceMatrix=mesh.instanceMatrix;low.instanceColor=mesh.instanceColor;
   low.userData={...mesh.userData,decorativePlantingLOD:{level:'distant',sourceCount,sourceIndices:cell.indices}};
   mesh.userData.decorativePlantingLOD={level:'original',sourceCount,sourceIndices:cell.indices};
   // Attach on the first view update, after the scene's existing provenance
   // traversal. New LOD primitives must not renumber the original geometry's
   // sub-millimetre signatures. This new geometry has its own signature above.
   low.frustumCulled=mesh.frustumCulled;low.visible=false;lowChunks.push(low);pairs.push({near:mesh,far:low,coverage:{value:1},fade:null});
  }
 }
 let disposed=false,detail='auto';
 function prepareFade(pair){
  if(pair.fade)return pair.fade;
  const make=(material,isNear)=>{const value=ditherMaterial(material,pair.coverage,isNear);fadeMaterials.add(value);return value;};
  const fade={near:make(source.material.clone(),true),far:make(source.material.clone(),false)};
  if(source.castShadow){
   fade.nearDepth=make(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),true);fade.farDepth=make(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),false);
   fade.nearDistance=make(new THREE.MeshDistanceMaterial(),true);fade.farDistance=make(new THREE.MeshDistanceMaterial(),false);
  }
  pair.fade=fade;return fade;
 }
 function select(pair,nearCoverage){
  pair.coverage.value=nearCoverage;pair.near.visible=nearCoverage>0;pair.far.visible=nearCoverage<1;
  const transition=nearCoverage>0&&nearCoverage<1,fade=transition?prepareFade(pair):null;
  pair.near.material=fade?.near??source.material;pair.far.material=fade?.far??source.material;
  pair.near.customDepthMaterial=fade?.nearDepth??source.customDepthMaterial;pair.far.customDepthMaterial=fade?.farDepth??source.customDepthMaterial;
  pair.near.customDistanceMaterial=fade?.nearDistance??source.customDistanceMaterial;pair.far.customDistanceMaterial=fade?.farDistance??source.customDistanceMaterial;
 }
 const viewerPosition=new THREE.Vector3(),worldBox=new THREE.Box3();
 function updateLOD(camera){
  if(!lod||disposed)return;
  viewerPosition.setFromMatrixPosition(camera.matrixWorld);
  const projectionScale=camera.isPerspectiveCamera?camera.projectionMatrix.elements[5]/Math.sqrt(3):null;
  for(const pair of pairs){
   if(!pair.far.parent){group.add(pair.far);pair.far.updateMatrixWorld(true);}
   // Nearest point of the complete cell, rather than its centre, protects all
   // plants near the pedestrian. Optical zoom retains their close detail.
   worldBox.copy(pair.near.boundingBox).applyMatrix4(group.matrixWorld);
   const distance=projectionScale?worldBox.distanceToPoint(viewerPosition)/projectionScale:camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom*Math.sqrt(3)/2:0;
   const linear=THREE.MathUtils.clamp((distance-(lod.distance-lod.fade/2))/lod.fade,0,1),blend=linear*linear*(3-2*linear);
   select(pair,detail==='full'?1:1-blend);
  }
 }
 if(lod)group.update=updateLOD;
 function sync(){
  if(disposed)return;
  if(source.count!==sourceCount)throw new Error('Spatial planting membership changed; rebuild its cells before rendering');
  source.updateMatrix();group.matrix.copy(source.matrix);group.matrixWorldNeedsUpdate=true;group.visible=source.visible;group.layers.mask=source.layers.mask;group.renderOrder=source.renderOrder;
  for(const mesh of chunks){
   const indices=mesh.userData.spatialChunk.sourceIndices;
   indices.forEach((index,local)=>{
    mesh.instanceMatrix.array.set(source.instanceMatrix.array.subarray(index*16,index*16+16),local*16);
    if(mesh.instanceColor)mesh.instanceColor.array.set(source.instanceColor.array.subarray(index*3,index*3+3),local*3);
   });
   mesh.material=source.material;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.layers.mask=source.layers.mask;mesh.renderOrder=source.renderOrder;
   mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   // Three unions the complete transformed geometry of every instance. A cell's
   // bounds therefore include overhanging branches; the grid never clips plants.
   mesh.computeBoundingBox();mesh.computeBoundingSphere();
   const epsilon=Math.max(1,mesh.boundingSphere.radius)*1e-6;
   mesh.boundingBox.expandByScalar(epsilon);mesh.boundingSphere.radius+=epsilon;
  }
  for(const pair of pairs){
   const low=pair.far;low.instanceColor=pair.near.instanceColor;low.castShadow=source.castShadow;low.receiveShadow=source.receiveShadow;low.layers.mask=source.layers.mask;low.renderOrder=source.renderOrder;
   low.computeBoundingBox();low.computeBoundingSphere();pair.near.boundingBox.union(low.boundingBox);pair.near.boundingSphere.union(low.boundingSphere);
   low.boundingBox.copy(pair.near.boundingBox);low.boundingSphere.copy(pair.near.boundingSphere);
   if(pair.fade){pair.fade.near.copy(source.material);pair.fade.far.copy(source.material);}
   select(pair,pair.coverage.value);
  }
 }
 sync();
 const siblingIndex=parent.children.indexOf(source);parent.remove(source);parent.add(group);
 parent.children.splice(parent.children.indexOf(group),1);parent.children.splice(siblingIndex,0,group);
 return{source,group,chunks,lowChunks,cellSize,sync,updateLOD,setDetail(mode='auto'){
  if(!['auto','full'].includes(mode))throw new TypeError('Planting detail must be auto or full');detail=mode;if(mode==='full')pairs.forEach(pair=>select(pair,1));
 },getDetail({includeIndices=false}={}){return{mode:detail,sourceCount,originalTriangles:(source.geometry.index?.count??source.geometry.attributes.position.count)/3,reducedTriangles:lod?(lod.geometry.index?.count??lod.geometry.attributes.position.count)/3:null,cells:pairs.map(pair=>({sourceCount:pair.near.count,...(includeIndices?{sourceIndices:pair.near.userData.spatialChunk.sourceIndices}:{}),nearCoverage:pair.coverage.value,nearVisible:pair.near.visible,farVisible:pair.far.visible}))};},dispose(){
  // The owning component traverses/disposes visible chunks and shared resources.
  // Release the detached original as well (it may have been uploaded before use).
  if(disposed)return;disposed=true;
  // The owner disposes every child geometry/buffer, including a scene that was
  // constructed and disposed before any camera render.
  for(const mesh of lowChunks)if(!mesh.parent)group.add(mesh);
  source.dispose();for(const material of fadeMaterials)material.dispose();
 }};
}
