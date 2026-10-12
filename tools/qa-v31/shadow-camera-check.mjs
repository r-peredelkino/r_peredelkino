// Geometric invariants independent of the renderer's sampled shadow map.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../dist/vendor/three.module.js';
import {createSolarShadowCameraFitter,collectSolarShadowBounds,solarShadowReceiverPoints} from '../../dist/solar-shadow-camera.js';
import {complexFootprints as f} from '../../dist/complex-footprints.js';
import {geoFrame,geoToWorld,metersToModel} from '../../dist/geo-reference.js';
import {resolveNeighborBuildingLayout} from '../../dist/neighbor-building-layout.js';

const checks=[],record=(name,details)=>checks.push({name,pass:true,...details});
const corners=box=>{const a=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])a.push(new T.Vector3(x,y,z));return a;};
const direction=(azimuth,elevation)=>{
 const a=azimuth*Math.PI/180,h=elevation*Math.PI/180,n=geoFrame.northWorld,e=geoFrame.eastWorld;
 return new T.Vector3((n[0]*Math.cos(a)+e[0]*Math.sin(a))*Math.cos(h),Math.sin(h),(n[1]*Math.cos(a)+e[1]*Math.sin(a))*Math.cos(h));
};
const casters=new T.Box3();
for(const b of f.buildings)for(const [x,z] of b.shape)for(const y of [0,b.h+1.84])casters.expandByPoint(new T.Vector3(x+b.x,y,z+b.z));
for(const b of resolveNeighborBuildingLayout())for(const [lon,lat] of b.coordinates)for(const y of [b.baseY,b.baseY+metersToModel(b.height+2)])casters.expandByPoint(new T.Vector3(...geoToWorld(lon,lat,y)));
const sourceCasterBounds=casters.clone();
// Explicit adversarial distant geometry tests camera depth, not physical site dimensions.
casters.union(new T.Box3(new T.Vector3(-1700,-3,-1600),new T.Vector3(1600,110,1800)));
const receivers=new T.Box3(new T.Vector3(-1600,-3,-1800),new T.Vector3(1600,110,1800));
const light=new T.DirectionalLight();light.castShadow=true;light.shadow.mapSize.set(4096,4096);
const scene=new T.Scene();scene.add(light,light.target);
const fitter=createSolarShadowCameraFitter(light,{casterBounds:casters,receiverBounds:receivers});
const perspective=(p,target,fov=70)=>{const c=new T.PerspectiveCamera(fov,1.7,.08,900);c.position.set(...p);c.lookAt(...target);c.updateMatrixWorld(true);return c;};
const overhead=new T.OrthographicCamera(-180,180,125,-125,1,2000);overhead.position.set(...f.views.overview.position);overhead.lookAt(...f.views.overview.target);overhead.updateMatrixWorld(true);
const top=new T.OrthographicCamera(-180,180,125,-125,1,2000);top.position.set(-geoFrame.northWorld[0]*.01,350,-geoFrame.northWorld[1]*.01);top.lookAt(0,0,0);top.updateMatrixWorld(true);
const cameras=[['overview',overhead],['top',top],['walk-north',perspective([14,1.7,-102],[3,1.7,-86])],['walk-south',perspective([14,1.7,-102],[25,1.7,-118])],['walk-up',perspective([-50,1.7,30],[-10,60,-25])],['apartment',perspective([-12,26,-60],[25,27,-40],42)]];
const suns=[['summer-noon',180,57.65],['winter-noon',173.38,10.71],['near-horizon-east',90,.25],['near-horizon-west',270,.25],['near-horizon-north',0,.25],['near-horizon-south',180,.25],['morning',105,2.18],['zenith',180,90],['below-horizon',180,-5]];
let maxReceiverOutside=0,maxDepthOutside=0,maxRayXYError=0,maxDirectionError=0;
for(const [cameraName,camera] of cameras)for(const [sunName,azimuth,elevation] of suns){
 const ray=direction(azimuth,elevation),state=fitter.fit({camera,direction:ray});
 const receiverPoints=solarShadowReceiverPoints(camera,receivers).points;
 assert.ok(receiverPoints.length>0,`${cameraName}: missing intersection`);
 for(const p of receiverPoints){
  const clip=p.clone().project(light.shadow.camera);
  const outside=Math.max(Math.abs(clip.x)-1,Math.abs(clip.y)-1,Math.abs(clip.z)-1,0);
  maxReceiverOutside=Math.max(maxReceiverOutside,outside);assert.ok(outside<1e-7,`${cameraName}/${sunName}: receiver clipped ${outside}`);
  const upstream=p.clone().addScaledVector(ray,500),a=p.clone().project(light.shadow.camera),b=upstream.project(light.shadow.camera);
  const error=Math.hypot(a.x-b.x,a.y-b.y);maxRayXYError=Math.max(maxRayXYError,error);assert.ok(error<1e-8,'Parallel blocker must keep the receiver light-space XY');
 }
 for(const p of corners(casters)){
  const eye=p.applyMatrix4(light.shadow.camera.matrixWorldInverse),depth=-eye.z;
  const outside=Math.max(state.near-depth,depth-state.far,0);maxDepthOutside=Math.max(maxDepthOutside,outside);assert.ok(outside<1e-7,`${cameraName}/${sunName}: caster depth clipped`);
 }
 const exact=new T.Vector3().subVectors(new T.Vector3(...state.lightWorldPosition),new T.Vector3(...state.lightWorldTarget)).normalize();
 const error=exact.distanceTo(ray);maxDirectionError=Math.max(maxDirectionError,error);assert.ok(error<1e-10,'Fitting must not change solar direction');
 assert.ok([state.width,state.height,state.near,state.far,...state.texelWorld].every(Number.isFinite));
 assert.ok(state.far>state.near&&state.width>0&&state.height>0);
 record(`${cameraName}/${sunName}`,{receiverVertices:receiverPoints.length,width:state.width,height:state.height,near:state.near,far:state.far,texelWorld:state.texelWorld});
}
record('receiver-and-caster-frustum-invariants',{cases:cameras.length*suns.length,maxReceiverOutside,maxDepthOutside,maxRayXYError,maxDirectionError});

// Independent dense visibility sampling checks the convex-intersection method.
let seed=31417,sampledVisible=0,maxSampleOutside=0;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const [name,camera] of cameras){
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 fitter.fit({camera,direction:direction(112,3)});
 for(let i=0;i<10000;i++){
  const p=new T.Vector3(T.MathUtils.lerp(receivers.min.x,receivers.max.x,random()),T.MathUtils.lerp(receivers.min.y,receivers.max.y,random()),T.MathUtils.lerp(receivers.min.z,receivers.max.z,random()));
  if(!frustum.containsPoint(p))continue;sampledVisible++;
  const clip=p.project(light.shadow.camera),outside=Math.max(Math.abs(clip.x)-1,Math.abs(clip.y)-1,Math.abs(clip.z)-1,0);maxSampleOutside=Math.max(maxSampleOutside,outside);assert.ok(outside<1e-7,`${name}: independently sampled visible receiver clipped`);
 }
}
assert.ok(sampledVisible>100);record('independent-visible-volume-sampling',{candidates:60000,sampledVisible,maxSampleOutside});

const smallReceiver=new T.Box3(new T.Vector3(-10,0,-10),new T.Vector3(10,100,10));
const first=fitter.fit({direction:direction(180,20),receiverBounds:smallReceiver});
const tiny=smallReceiver.clone().translate(new T.Vector3(1e-9,0,0));
const second=fitter.fit({direction:direction(180,20),receiverBounds:tiny});
assert.deepEqual(first.snappedLightCenter.slice(0,2),second.snappedLightCenter.slice(0,2));
assert.equal(first.width,second.width);assert.equal(first.height,second.height);
record('sub-texel-camera-stability',{texelWorld:second.texelWorld});

// A parent transform and two distant instances must both affect the single scan.
const model=new T.Group();model.position.set(100,3,-40);model.rotation.y=.7;
const box=new T.BoxGeometry(2,6,4),material=new T.MeshStandardMaterial();
const instances=new T.InstancedMesh(box,material,2),matrix=new T.Matrix4();instances.castShadow=instances.receiveShadow=true;
instances.setMatrixAt(0,matrix.makeTranslation(0,3,0));instances.setMatrixAt(1,matrix.makeTranslation(75,14,-120));model.add(instances);
const bounds=collectSolarShadowBounds(model,{padding:0});
model.updateMatrixWorld(true);
for(const local of [new T.Vector3(-1,0,-2),new T.Vector3(1,6,2),new T.Vector3(74,11,-122),new T.Vector3(76,17,-118)])assert.ok(bounds.casterBounds.containsPoint(local.applyMatrix4(model.matrixWorld)));
record('one-time-transformed-instance-bounds',{counts:bounds.metadata});
fitter.setBounds(bounds);fitter.fit({direction:direction(260,5)});
assert.throws(()=>fitter.fit({direction:[0,0,0]}),/Invalid solar direction/);
assert.throws(()=>createSolarShadowCameraFitter(light,{casterBounds:new T.Box3(),receiverBounds:receivers}),/Finite/);
record('invalid-input-rejection-and-bound-refresh',{});

const result={status:'PASS',createdAt:new Date().toISOString(),checks,metrics:{maxReceiverOutside,maxDepthOutside,maxRayXYError,maxDirectionError,sampledVisible,maxSampleOutside},sourceCasterBounds:{min:sourceCasterBounds.min.toArray(),max:sourceCasterBounds.max.toArray()},scope:'Tests camera coverage and exact preservation of parallel solar direction; does not certify source heights, terrain, or sampled GPU shadow accuracy.'};
const output=new URL('./shadow-camera-check.json',import.meta.url);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,checks:checks.length,...result.metrics,output:output.pathname},null,2));
