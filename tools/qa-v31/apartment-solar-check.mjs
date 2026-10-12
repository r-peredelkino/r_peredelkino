import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {registerHooks} from 'node:module';
import * as T from '../../dist/vendor/three.module.js';
import {createApartment} from '../../dist/apartment-model.js';
import {createApartment as createBaselineApartment} from '../../../rodina-v30/dist/apartment-model.js';
import {apartmentPlans} from '../../dist/apartment-plans.js';
import {insideRing} from '../../dist/walk-physics.js';
import {cutApartmentOpenings} from '../../dist/apartment-apertures.js';
import {createComplex} from '../../dist/complex-model.js';

// Import integration helpers without initializing a DOM or a renderer.
const originalWindow=globalThis.window,originalDocument=globalThis.document;
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
globalThis.window={};globalThis.document={querySelector:()=>({addEventListener(){}})};
const {cutApartmentShadowOpenings,retainApartmentContextShadows}=await import('../../dist/apartment3d.js');
if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
const hash=value=>crypto.createHash('sha256').update(Buffer.from(value.buffer,value.byteOffset,value.byteLength)).digest('hex');
function capture(apt){const meshes=[];apt.root.traverse(o=>{if(!o.isMesh||o.userData.shadowOnly)return;meshes.push({attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,v])=>[k,hash(v.array)])),index:o.geometry.index?hash(o.geometry.index.array):null,matrix:o.matrix.toArray()});});return meshes;}
const report={pass:false,apartments:{},context:{},limitations:['CPU geometry and callback checks; native GPU shader/pixel verification is separate.','Facade registration uses the existing finite opening tolerance: 1.35 m normal to each traced segment, 0.08 m at either end.','Window sill/head and facade registration are estimated source-model geometry, not surveyed dimensions.']};
function rayHits(mesh,ray){const hits=[];T.Mesh.prototype.raycast.call(mesh,ray,hits);return hits;}
for(const id of Object.keys(apartmentPlans)){
 const apt=createApartment(id),baseline=createBaselineApartment(id),geometry=capture(apt);assert.deepEqual(geometry,capture(baseline),'Original apartment positions and all geometry attributes match v30 exactly');baseline.dispose();
 const p=apt.metrics.placement;apt.root.position.set(p.x,p.y,p.z);apt.root.rotation.y=p.angle;apt.root.updateMatrixWorld(true);
 const proxies=[],glass=[],byId=new Map();apt.root.traverse(o=>{byId.set(o.uuid,o);if(o.userData.shadowOnly)proxies.push(o);if(o.isMesh&&o.material.transparent)glass.push(o);});
 assert.ok(proxies.length>0);assert.ok(glass.length>0);assert.ok(glass.every(o=>!o.castShadow),'Glass never makes an opaque solar shadow');
 for(const proxy of proxies){const source=byId.get(proxy.userData.sourceMesh);assert.strictEqual(proxy.geometry,source.geometry);assert.deepEqual(proxy.matrixWorld.elements,source.matrixWorld.elements);assert.equal(proxy.material.colorWrite,false);assert.equal(proxy.material.depthWrite,false);assert.equal(proxy.material.side,T.DoubleSide);assert.equal(proxy.castShadow,true);assert.equal(proxy.receiveShadow,false);const pick=[];proxy.raycast(new T.Raycaster(),pick);assert.equal(pick.length,0,'Invisible envelope cannot be picked');}
 assert.ok(apt.upperShadow.visible&&apt.ceilingShadow.visible);apt.setFull(true);assert.ok(apt.upper.visible&&!apt.upperShadow.visible&&apt.ceilingShadow.visible);apt.setWalking(true);assert.ok(apt.upper.visible&&apt.ceiling.visible&&!apt.upperShadow.visible&&!apt.ceilingShadow.visible);apt.setWalking(false);assert.ok(apt.upper.visible&&!apt.ceiling.visible&&!apt.upperShadow.visible&&apt.ceilingShadow.visible);apt.setFull(false);
 const localToWorld=(x,y,z)=>apt.root.localToWorld(new T.Vector3(x,y,z));
 let ceilingRays=0,openWindowRays=0,frameRays=0;
 for(let i=0;i<apt.data.rooms.length;i++){const at=apt.world.roomPoint(i);assert.ok(at);const ray=new T.Raycaster(localToWorld(at.x,4,at.z),new T.Vector3(0,-1,0),0,4);assert.ok(apt.ceilingShadow.children.some(m=>rayHits(m,ray).some(h=>Math.abs(h.point.y-(p.y+apt.data.ceilingHeight))<.001)),'Hidden ceiling still intercepts vertical sunlight over every room');ceilingRays++;}
 const outline=apt.data.outline.map(a=>apt.metrics.coord(...a));
 apt.data.windows.forEach((a,index)=>{
  const [ax,az]=apt.metrics.coord(a[0],a[1]),[bx,bz]=apt.metrics.coord(a[2],a[3]),dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);let nx=-dz/length,nz=dx/length;
  if(insideRing((ax+bx)/2+nx*.25,(az+bz)/2+nz*.25,outline)){nx=-nx;nz=-nz;}
  const bays=apt.data.windowProfile.bays?.[index]??Math.max(1,Math.round(length/.95)),fraction=.5/bays,wx=ax+dx*fraction,wz=az+dz*fraction;
  const direction=new T.Vector3(nx,0,nz).transformDirection(apt.root.matrixWorld);
  const clear=new T.Raycaster(localToWorld(wx-nx*.4,1.65,wz-nz*.4),direction,0,.8);
  assert.ok(apt.upperShadow.children.every(m=>rayHits(m,clear).length===0),`${id} window ${index}: clear pane is not covered by shadow-only walls`);openWindowRays++;
  const frame=new T.Raycaster(localToWorld(ax-nx*.4,1.65,az-nz*.4),direction,0,.8);
  assert.ok(apt.upperShadow.children.some(m=>rayHits(m,frame).length>0),`${id} window ${index}: opaque frame is retained`);frameRays++;
 });
 const ownedGeometries=new Set(),disposalCounts=new Map();apt.root.traverse(o=>{if(o.geometry)ownedGeometries.add(o.geometry);});ownedGeometries.forEach(g=>{disposalCounts.set(g,0);g.addEventListener('dispose',()=>disposalCounts.set(g,disposalCounts.get(g)+1));});
 const world=apt.world;apt.setArtificialLight(true);apt.setArtificialLight(false);assert.strictEqual(apt.world,world,'Lighting does not rebuild or mutate walking collisions');apt.dispose();assert.ok([...disposalCounts.values()].every(n=>n===1),'Shared proxy/source geometry is disposed exactly once');
 report.apartments[id]={sourceMeshCount:geometry.length,proxyCount:proxies.length,glassCount:glass.length,ceilingRays,openWindowRays,frameRays,originalGeometryUnchanged:true,sourceGeometryDisposalOnce:true};
}

const model=createComplex(),apt=createApartment('1-59'),tower=model.towers.get(apt.metrics.placement.building);
cutApartmentOpenings(tower,apt);const apertures=cutApartmentShadowOpenings(tower,apt);assert.ok(apertures.materials.length>0);assert.strictEqual(cutApartmentShadowOpenings(tower,apt),apertures);
let shadowCasters=0,bentCasters=0;
tower.group.traverse(o=>{if(!o.isMesh||!o.castShadow)return;shadowCasters++;
 for(const material of[o.customDepthMaterial,o.customDistanceMaterial]){
  assert.ok(material);const source=material.isMeshDistanceMaterial?T.ShaderLib.distanceRGBA:T.ShaderLib.depth,shader={uniforms:{},vertexShader:source.vertexShader,fragmentShader:source.fragmentShader};material.onBeforeCompile(shader,null);
  assert.equal(shader.uniforms.rpApertures.value.length,apt.data.windows.length);assert.deepEqual(shader.uniforms.rpApartment.value.toArray(),[apt.metrics.placement.x,apt.metrics.placement.y,apt.metrics.placement.z,apt.metrics.placement.angle]);assert.ok(shader.vertexShader.includes('instanceMatrix*rpOpeningP'));assert.ok(shader.fragmentShader.includes('abs(rpV)<1.35'));assert.ok(shader.fragmentShader.includes('rpDelta.y<2.840'));assert.ok(shader.fragmentShader.includes('discard;'));
  if(o.geometry.attributes.paneBend){assert.ok(shader.vertexShader.includes('transformed.z+=paneBend'));bentCasters++;}
 }
});
let visible=false,beforeCalls=0,afterCalls=0;const sampleMesh=tower.facade;
sampleMesh.onBeforeRender=()=>beforeCalls++;sampleMesh.onAfterRender=()=>afterCalls++;const before=sampleMesh.onBeforeRender,after=sampleMesh.onAfterRender,beforeShadow=sampleMesh.onBeforeShadow;
const wrapper=retainApartmentContextShadows(model,()=>visible),camera=new T.PerspectiveCamera(60,1,.1,1000);model.root.updateMatrixWorld(true);
const batches=model.publicRealm.forecourt.landscape.spatialInstances;camera.position.set(1000,300,1000);camera.updateMatrixWorld();batches.forEach(b=>b.updateLOD(camera));
let guardedDraws=0;const materials=new Map();model.root.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.set(m,[m.colorWrite,m.depthWrite]);});
function simulateMainDraw(mesh,material){const state=[material.colorWrite,material.depthWrite],caster=mesh.castShadow;mesh.onBeforeRender(null,null,camera,mesh.geometry,material,null);assert.equal(material.colorWrite,false);assert.equal(material.depthWrite,false);assert.equal(mesh.castShadow,caster,'Main-pass masking cannot disable a shadow caster');mesh.onAfterRender(null,null,camera,mesh.geometry,material,null);assert.deepEqual([material.colorWrite,material.depthWrite],state);guardedDraws++;}
model.root.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])simulateMainDraw(o,m);});
for(const [material,flags]of materials)assert.deepEqual([material.colorWrite,material.depthWrite],flags,'All original material write masks restored after a main pass');assert.strictEqual(sampleMesh.onBeforeShadow,beforeShadow,'Shadow callbacks are untouched');assert.equal(beforeCalls,1);assert.equal(afterCalls,1);
// Exercise materials created lazily during the smooth planting transition.
let lazyMaterials=0;
for(const batch of batches){const first=batch.chunks[0],center=first.boundingBox.getCenter(new T.Vector3());camera.position.set(center.x,center.y,first.boundingBox.max.z+batch.group.userData.decorativePlantingLOD.distance);camera.updateMatrixWorld();batch.updateLOD(camera);for(const mesh of[...batch.chunks,...batch.lowChunks])if(mesh.material.userData.decorativePlantingLOD){simulateMainDraw(mesh,mesh.material);lazyMaterials++;}}
assert.ok(lazyMaterials>0);visible=true;sampleMesh.onBeforeRender(null,null,camera,sampleMesh.geometry,sampleMesh.material,null);assert.equal(sampleMesh.material.colorWrite,true);sampleMesh.onAfterRender();wrapper.dispose();assert.strictEqual(sampleMesh.onBeforeRender,before);assert.strictEqual(sampleMesh.onAfterRender,after);
const shadowDisposals=new Map(apertures.materials.map(m=>[m,0]));for(const m of apertures.materials)m.addEventListener('dispose',()=>shadowDisposals.set(m,shadowDisposals.get(m)+1));apertures.dispose();apertures.dispose();assert.ok([...shadowDisposals.values()].every(n=>n===1));assert.equal(tower.apartmentShadowOpenings,undefined);
report.context={shadowCasters,customDepthAndDistanceMaterials:apertures.materials.length,bentShadowMaterials:bentCasters,guardedDraws,lazyLODMaterials:lazyMaterials,hookedMeshes:wrapper.meshes,writeMasksRestored:true,shadowCallbacksUnchanged:true};
model.dispose();apt.dispose();report.pass=true;
fs.writeFileSync(new URL('apartment-solar-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
