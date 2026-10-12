// CPU regression checks for the shipped exterior scene; no browser or extra packages.
// Run from the project root: node tools/qa/exterior-model.mjs
import assert from 'node:assert/strict';
import * as THREE from '../../dist/vendor/three.module.js';
import {complexFootprints as footprint} from '../../dist/complex-footprints.js';
import {createComplex} from '../../dist/complex-model.js';
import {serviceRoofContains} from '../../dist/exterior-roofs.js';
import {insideRing,segmentDistance,createWalkWorld} from '../../dist/walk-physics.js';

const tolerance=.0002; // Both meshes may carry the existing sub-0.08 mm provenance stamp.
const near=(actual,expected,epsilon,message)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${message}: ${actual} vs ${expected}`);
const ringDistance=(x,z,ring)=>ring.reduce((d,p,i)=>Math.min(d,segmentDistance(x,z,p,ring[(i+1)%ring.length])),Infinity);
const inClosedRing=(x,z,ring)=>insideRing(x,z,ring)||ringDistance(x,z,ring)<tolerance;
const boundsOf=mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};

// Keep the actual equipment meshes before batching destroys their component
// identity. References retain their geometry arrays after dispose(), while the
// real scene still uses its normal batches. Do not duplicate the model builder.
const originals=[],terraceFloors=[],add=THREE.Group.prototype.add;
THREE.Group.prototype.add=function(...objects){
 if(this.name==='Service roofs · mineral gravel, parapets and ventilation'){
  for(const object of objects)if(object.isMesh)originals.push({mesh:object,geometry:object.geometry,material:object.material,type:object.geometry.type});
 }
 if(this.name==='Second-floor planted terraces with glass balustrades'){
  for(const object of objects)if(object.isMesh&&object.geometry.type==='ExtrudeGeometry')terraceFloors.push({mesh:object,geometry:object.geometry,material:object.material});
 }
 return add.apply(this,objects);
};
let model;
try{model=createComplex()}finally{THREE.Group.prototype.add=add}
model.root.updateMatrixWorld(true);
const roofs=model.exteriorRoofs,terraces=model.terraces;
assert.ok(roofs&&terraces,'Both exterior roof and furnished terrace systems exist');

const disposal=[];
for(const [label,group] of [['roof',roofs.group],['terrace',terraces.group]]){
 const geometries=new Set();group.traverse(object=>{if(object.geometry)geometries.add(object.geometry)});
 assert.ok(geometries.size>0,`${label} has live geometries`);
 for(const geometry of geometries){const record={label,disposed:false};geometry.addEventListener('dispose',()=>{record.disposed=true});disposal.push(record)}
}
const textureRecord={disposed:false};roofs.materials.gravel.map.addEventListener('dispose',()=>{textureRecord.disposed=true});
const terraceInstances=[];
terraces.group.traverse(object=>{if(object.isInstancedMesh){const record={disposed:false};object.addEventListener('dispose',()=>{record.disposed=true});terraceInstances.push(record)}});
const results={};

try{
 // An open Shape omits the final side from getSpacedPoints even when extrusion
 // appears closed. Compare the complete source perimeter and the final bays.
 assert.equal(model.towers.size,6);
 results.towers=[];
 for(const [id,tower] of model.towers){
  const shape=tower.shape,first=shape.getPoint(0),last=shape.getPoint(1);
  near(first.distanceTo(last),0,1e-8,`Tower ${id}: explicit Shape closure`);
  const source=footprint.buildings.find(building=>building.id===id).shape;
  const closedLength=source.reduce((sum,p,i)=>{const q=source[(i+1)%source.length];return sum+Math.hypot(q[0]-p[0],q[1]-p[1])},0);
  near(shape.getLength(),closedLength,.0001,`Tower ${id}: complete authored perimeter`);
  assert.equal(tower.bays.length,tower.columns);
  const nominal=closedLength/tower.columns;
  for(const bay of tower.bays.slice(-3))assert.ok(bay.length>nominal*.93&&bay.length<nominal*1.001,`Tower ${id}: final window bays retain the normal pitch`);

  const count=tower.columns*tower.spec.floors,slots=id===0?1:3;
  const frames=tower.group.children.find(object=>object.name===(id===0?'Close-spaced white office fins':'Recessed residential window frames and opening sashes'));
  assert.ok(frames,`Tower ${id}: frame mesh`);assert.equal(frames.count,count*slots);
  assert.equal(tower.windows.count,count);
  for(const name of ['paneBend','paneGlow','paneTint'])assert.equal(tower.windows.geometry.attributes[name].count,count,`Tower ${id}: ${name} indexing`);
  assert.ok(frames.instanceMatrix.array.every(Number.isFinite),`Tower ${id}: finite instance matrices`);
  const hidden=index=>{const offset=index*16,a=frames.instanceMatrix.array;return [0,1,2,4,5,6,8,9,10].every(component=>a[offset+component]===0)};
  let hiddenFrames=0;for(let i=0;i<frames.count;i++)hiddenFrames+=Number(hidden(i));
  assert.equal(hiddenFrames,id===0?0:tower.columns*3+tower.panelIndices.length*2,`Tower ${id}: exactly the intended frame slots are hidden`);
  tower.windowLights.update(20,22,1);
  for(const index of [...tower.panelIndices,...(id===0?[]:Array.from({length:tower.columns},(_,i)=>i))])assert.equal(tower.windowLights.strengths[index],0,`Tower ${id}: covered windows stay unlit`);

  let minimumBandClearance=Infinity,minimumCornerClearance=Infinity;
  if(id!==0){
   frames.geometry.computeBoundingBox();tower.facadeBands.geometry.computeBoundingBox();
   const frameMatrix=new THREE.Matrix4(),bandMatrix=new THREE.Matrix4(),bandBox=tower.facadeBands.geometry.boundingBox;
   assert.equal(tower.facadeBands.count,tower.spec.floors);
   assert.ok(tower.facadeBands.geometry.userData.ribbon.samples<=432);
   assert.ok(tower.facadeBands.geometry.userData.ribbon.profileSegments<=6);
   for(let floor=1;floor<tower.spec.floors;floor++){
    tower.facadeBands.getMatrixAt(floor,bandMatrix);
    const lowerBandTop=bandBox.clone().applyMatrix4(bandMatrix).max.y;
    let upperBandBottom=Infinity;
    if(floor+1<tower.spec.floors){tower.facadeBands.getMatrixAt(floor+1,bandMatrix);upperBandBottom=bandBox.clone().applyMatrix4(bandMatrix).min.y}
    for(let bay=0;bay<tower.columns;bay++)for(let part=0;part<slots;part++){
     const index=(floor*tower.columns+bay)*slots+part;if(hidden(index))continue;
     frames.getMatrixAt(index,frameMatrix);const frameBox=frames.geometry.boundingBox.clone().applyMatrix4(frameMatrix);
     const clearance=frameBox.min.y-lowerBandTop;
     minimumBandClearance=Math.min(minimumBandClearance,clearance,upperBandBottom-frameBox.max.y);
     assert.ok(clearance>=-tolerance&&frameBox.max.y<=upperBandBottom+tolerance,`Tower ${id}, floor ${floor}, bay ${bay}, frame ${part}: dark frame cuts through a white band`);
     if(part===1&&Math.abs(tower.bays[bay].bend)>.02){
      const b=tower.bays[bay],dx=frameMatrix.elements[12]-b.cx,dz=frameMatrix.elements[14]-b.cz;
      const outward=dx*b.normal[0]+dz*b.normal[1],u=dx*Math.cos(b.angle)-dz*Math.sin(b.angle);
      const localZDotNormal=Math.sin(b.angle)*b.normal[0]+Math.cos(b.angle)*b.normal[1];
      const glass=.11+localZDotNormal*b.bend*(1-4*u*u/(b.length*.985)**2);
      minimumCornerClearance=Math.min(minimumCornerClearance,outward-glass);
      assert.ok(outward-glass>.025,`Tower ${id}, bay ${bay}: curved sash is buried behind its glazing`);
     }
    }
   }
  }
  results.towers.push({id,windows:count,frames:frames.count,hiddenFrames,lastBayPitchRatio:tower.bays.at(-1).length/nominal,
   minimumBandClearance:Number.isFinite(minimumBandClearance)?minimumBandClearance:null,minimumCornerClearance:Number.isFinite(minimumCornerClearance)?minimumCornerClearance:null});
 }

 // Inspect every real roof triangle, including the central pole where a second
 // triangle of a collapsed quad used to have zero area.
 const crown=model.arenaRoof.geometry,p=crown.attributes.position,n=crown.attributes.normal,indices=crown.index?.array;
 assert.ok(indices,'Arena crown uses indexed geometry');
 for(const attribute of [p,n,crown.attributes.uv])assert.ok(attribute.array.every(Number.isFinite),'Finite crown position/normal/UV');
 let smallestTriangle=Infinity,minNormalAlignment=1;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3(),average=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<indices.length;i+=3){
  const ia=indices[i],ib=indices[i+1],ic=indices[i+2];
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);
  cross.crossVectors(b.sub(a),c.sub(a));const area=cross.length()*.5;smallestTriangle=Math.min(smallestTriangle,area);
  assert.ok(area>1e-8,`Arena crown triangle ${i/3} is degenerate`);
  average.fromBufferAttribute(n,ia).add(normal.fromBufferAttribute(n,ib)).add(normal.fromBufferAttribute(n,ic)).normalize();
  const alignment=cross.normalize().dot(average);minNormalAlignment=Math.min(minNormalAlignment,alignment);assert.ok(alignment>.9,'Arena crown triangle winding agrees with its normal');
 }
 crown.computeBoundingBox();const radius=Math.hypot(footprint.arena.outer[0][0]-model.arenaCenter[0],footprint.arena.outer[0][1]-model.arenaCenter[1]);
 for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-crown.boundingBox.min.y)<tolerance)near(Math.hypot(p.getX(i),p.getZ(i)),radius,.001,'Arena base keeps the circular source footprint');
 results.crown={triangles:indices.length/3,smallestTriangle,minNormalAlignment};

 // Compare actual rendered heights after batching and the provenance stamp.
 const roofSurface=roofs.group.children.find(object=>object.material===roofs.materials.gravel);
 assert.ok(roofSurface,'Gravel surface exists');const gravelBounds=boundsOf(roofSurface);
 const legacySlabs=model.root.children.filter(object=>{
  if(!object.isMesh||object.isInstancedMesh)return false;
  const box=boundsOf(object);return box.min.y>roofs.roofLevel-.15&&box.max.y<roofs.roofLevel&&box.max.y-box.min.y>.05&&box.max.y-box.min.y<.12;
 });
 assert.equal(legacySlabs.length,1,'The original thin podium roof slab is identifiable');
 const legacyTop=boundsOf(legacySlabs[0]).max.y;
 let lowestFinishedTile=Infinity;
 // Read the top of each actual floor extrusion before their material batch;
 // a bottom-cap triangle's winding is not a reliable way to identify its top.
 for(const floor of terraceFloors)if(floor.material===terraces.mats.tile){
  floor.mesh.updateMatrix();floor.geometry.computeBoundingBox();
  lowestFinishedTile=Math.min(lowestFinishedTile,floor.geometry.boundingBox.clone().applyMatrix4(floor.mesh.matrix).max.y);
 }
 assert.ok(Number.isFinite(lowestFinishedTile),'Furnished terrace top faces exist');
 assert.ok(gravelBounds.min.y>legacyTop+.004,'Gravel is visible above the old slab');
 assert.ok(gravelBounds.max.y<lowestFinishedTile-.01,'Gravel stays below finished furnished terraces');
 near(roofs.materials.gravel.map.repeat.x,1.5,1e-8,'Gravel U repeat survives authorship bake');
 assert.equal(roofs.materials.gravel.map,roofs.materials.gravel.bumpMap,'Authored gravel texture is preserved by baking');
 assert.equal(roofs.materials.gravel.map.userData.attribution.handle,'@r_peredelkino');
 results.levels={legacyTop,gravel:[gravelBounds.min.y,gravelBounds.max.y],finishedTerrace:lowestFinishedTile};

 // Original component vertices are transformed exactly as batchStatic does.
 // This checks the full real duct/fan/support geometry, not only candidate centres.
 let equipmentVertices=0,equipmentMeshes=0,parapetSamples=0;
 const clusterUse=new Map(roofs.equipmentClusters.map(cluster=>[cluster,0]));
 const terraceWorlds=footprint.terraces.map(terrace=>createWalkWorld({boundary:terrace.outer,solids:terrace.holes.map(hole=>({outer:hole,holes:[]})),radius:.08}));
 for(const original of originals){
  const {mesh,geometry,material,type}=original;if(type==='BufferGeometry'||material===roofs.materials.gravel)continue;
  mesh.updateMatrix();
  if(material===roofs.materials.white){
   const {width,depth}=geometry.parameters,steps=Math.max(1,Math.ceil(width/.20)),point=new THREE.Vector3();
   for(let i=0;i<=steps;i++)for(const z of [-depth/2,0,depth/2]){
    point.set(-width/2+width*i/steps,0,z).applyMatrix4(mesh.matrix);parapetSamples++;
    assert.ok(terraceWorlds.every(world=>!world.free(point.x,point.z)),'A solid parapet crosses a furnished terrace');
   }
   continue;
  }
  const parapetCap=material===roofs.materials.metal&&type==='BoxGeometry'&&Math.abs(geometry.parameters.height-.045)<1e-8&&Math.abs(mesh.position.y-(roofs.roofLevel+.4425))<1e-8;
  if(parapetCap)continue;
  assert.ok(material===roofs.materials.metal||material===roofs.materials.dark,'Known roof equipment material');
  const cluster=roofs.equipmentClusters.find(item=>inClosedRing(mesh.position.x,mesh.position.z,item.footprint));
  assert.ok(cluster,'Equipment centre belongs to a declared cluster');clusterUse.set(cluster,clusterUse.get(cluster)+1);equipmentMeshes++;
  const position=geometry.attributes.position,point=new THREE.Vector3();
  for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrix);equipmentVertices++;
   assert.ok(serviceRoofContains(point.x,point.z,.05),'Actual equipment vertex escapes the usable service roof');
   assert.ok(inClosedRing(point.x,point.z,cluster.footprint),'Actual equipment vertex escapes its metadata footprint');
   assert.ok(point.y>=cluster.base-tolerance&&point.y<=cluster.base+cluster.height+tolerance,'Actual equipment height exceeds its metadata envelope');
  }
 }
 assert.ok(equipmentMeshes>0&&equipmentVertices>1000,'Actual unbatched roof equipment was inspected');
 assert.ok([...clusterUse.values()].every(count=>count>0),'Every declared cluster contains rendered equipment');
 assert.ok(parapetSamples>0,'Actual parapet footprints were inspected');
 results.equipment={clusters:roofs.equipmentClusters.length,meshes:equipmentMeshes,vertices:equipmentVertices,parapetSamples};
}finally{
 model.dispose();
}

assert.ok(disposal.every(record=>record.disposed),'dispose() releases every terrace and roof geometry, including detached batches');
assert.ok(terraceInstances.every(record=>record.disposed),'dispose() releases terrace instance buffers');
assert.ok(textureRecord.disposed,'dispose() releases the gravel texture');
assert.equal(roofs.group.parent,null);assert.equal(terraces.group.parent,null);
results.disposal={roofGeometries:disposal.filter(record=>record.label==='roof').length,terraceGeometries:disposal.filter(record=>record.label==='terrace').length,terraceInstances:terraceInstances.length,gravelTexture:true};
console.log('PASS: exterior geometry, complete window sampling, frame clipping, crown winding, roof clearances, real equipment footprints and disposal');
console.log(JSON.stringify(results,null,2));
