// Read-only scene-region audit: no source geometry/material or runtime edits.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {createSolarShadowCameraFitter,collectSolarShadowBounds,solarShadowReceiverPoints} from '../../dist/solar-shadow-camera.js';
import {geoFrame} from '../../dist/geo-reference.js';
import {apartmentPlans,apartmentMetrics} from '../../dist/apartment-plans.js';
import {createApartment} from '../../dist/apartment-model.js';

const started=performance.now(),model=createComplex();
model.root.updateWorldMatrix(true,true);
const path=object=>object===model.root?object.name:`${path(object.parent)}/${object.name||object.type}[${object.parent.children.indexOf(object)}]`;
const inSubtree=(object,ancestor)=>{for(let o=object;o;o=o.parent)if(o===ancestor)return true;return false;};
const skyKinds=new Map();
for(const c of model.life.clouds)c.g.traverse(o=>{if(o.geometry)skyKinds.set(o.geometry,'cloud');});
for(const b of model.life.birds)b.g.traverse(o=>{if(o.geometry)skyKinds.set(o.geometry,o===b.g.children[0]?'bird-body':'bird-wing');});
const isSky=object=>inSubtree(object,model.life.group)&&skyKinds.has(object.geometry);
const giant=model.neighborhood.forestGroup.getObjectByName('Continuous woodland ground');
assert.ok(giant,'Expected background ground mesh exists');
const isExcluded=object=>object===giant||isSky(object);
const boxJSON=box=>box.isEmpty()?null:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new T.Vector3()).toArray()};
const records=[];
model.root.traverse(object=>{
 if(!object.isMesh||!object.geometry?.attributes.position?.count||object.isInstancedMesh&&object.count===0)return;
 let box;
 if(object.isInstancedMesh){object.computeBoundingBox();box=object.boundingBox;}
 else{if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();box=object.geometry.boundingBox;}
 box=box.clone().applyMatrix4(object.matrixWorld);
 records.push({object,box});
});
function receiverBox(predicate=()=>true){const box=new T.Box3();for(const r of records)if(r.object.receiveShadow&&!isExcluded(r.object)&&predicate(r.object))box.union(r.box);return box;}
function describe(object){const rows=records.filter(r=>inSubtree(r.object,object)),all=new T.Box3(),casters=new T.Box3(),receivers=new T.Box3();let casterMeshes=0,receiverMeshes=0;
 for(const r of rows){all.union(r.box);if(r.object.castShadow){casters.union(r.box);casterMeshes++;}if(r.object.receiveShadow&&!isExcluded(r.object)){receivers.union(r.box);receiverMeshes++;}}
 return{name:object.name,path:path(object),type:object.type,meshCount:rows.length,casterMeshes,receiverMeshes,all:boxJSON(all),casters:boxJSON(casters),receivers:boxJSON(receivers)};
}
const plainObjects=value=>Object.values(value??{}).filter(v=>v?.isObject3D);
const localAccessObjects=plainObjects(model.neighborhood.localAccess),roadsideObjects=plainObjects(model.neighborhood.roadside);
const isCore=object=>![model.neighborhood.group,model.neighborhood.forestGroup,model.traffic.group].some(group=>inSubtree(object,group));
const core=receiverBox(isCore);
const withRoadside=receiverBox(object=>isCore(object)||roadsideObjects.some(o=>inSubtree(object,o)));
const builtDistrict=receiverBox(object=>!inSubtree(object,model.neighborhood.forestGroup));
const filteredAll=receiverBox();
const full=collectSolarShadowBounds(model.root,{padding:.5});
const filtered=collectSolarShadowBounds(model.root,{padding:.5,ignore:isExcluded});
assert.ok(filtered.casterBounds.equals(full.casterBounds),'Ground/sky ignore does not remove any real caster');
const primaryRegions={core,coreWithRoadside:withRoadside,builtDistrict,filteredAll,unfiltered:full.receiverBounds.clone().expandByScalar(-.5)};
const regions=Object.fromEntries(Object.entries(primaryRegions).map(([key,box])=>[key,box.clone().expandByScalar(.5)]));
const regionCoverage={};
for(const [name,region] of Object.entries(regions)){
 const included=records.filter(r=>r.object.receiveShadow&&!isExcluded(r.object)&&region.containsBox(r.box));
 const coreOutside=records.filter(r=>r.object.receiveShadow&&!isExcluded(r.object)&&isCore(r.object)&&!region.containsBox(r.box));
 regionCoverage[name]={completeReceiverMeshes:included.length,coreReceiverMeshesOmitted:coreOutside.map(r=>path(r.object))};
 if(name!=='unfiltered')assert.equal(coreOutside.length,0,`${name} must preserve the entire actual complex receiver envelope`);
}
const direction=(azimuth,elevation)=>{
 const a=azimuth*Math.PI/180,h=elevation*Math.PI/180,n=geoFrame.northWorld,e=geoFrame.eastWorld;
 return new T.Vector3((n[0]*Math.cos(a)+e[0]*Math.sin(a))*Math.cos(h),Math.sin(h),(n[1]*Math.cos(a)+e[1]*Math.sin(a))*Math.cos(h));
};
const cameraSpecs=[
 {name:'forecourt-source',position:[-88.38121210004893,54.055899587602426,-74.43182231121628],target:[-9.88329,0,-90.57749],fov:39.563767569092846,aspect:1700/1200,near:.1,far:2200},
 {name:'walk-actual-far900',position:[14,1.68,-102],target:[3,1.68,-86],fov:70,aspect:1.5,near:.08,far:900},
 {name:'walk-reversed-far900',position:[14,1.68,-102],target:[25,1.68,-118],fov:70,aspect:1.5,near:.08,far:900},
];
const aptWindowSpecs=[],apartmentBounds={};
for(const [id,data] of Object.entries(apartmentPlans)){
 const m=apartmentMetrics(data),p=m.placement,transform=new T.Matrix4().makeRotationY(p.angle);transform.setPosition(p.x,p.y,p.z);
 const apartment=createApartment(id);apartment.root.position.set(p.x,p.y,p.z);apartment.root.rotation.y=p.angle;
 const aptBounds=collectSolarShadowBounds(apartment.root,{padding:.5});
 apartmentBounds[id]={receiverBounds:aptBounds.receiverBounds,casterBounds:filtered.casterBounds.clone().union(aptBounds.casterBounds),metadata:aptBounds.metadata};
 apartment.dispose();
 const world=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(transform).toArray();
 const size=Math.max(m.width,m.depth);
 cameraSpecs.push({name:`apartment-${id}-overview-far1400`,position:world(size*.48,size*(id==='1-59'?1.1:.9),size*(id==='1-59'?-.93:.93)),target:world(0,.35,0),fov:42,aspect:1.5,near:.035,far:1400});
 // Window centres and outward directions are derived from the existing plan.
 // These are explicit synthetic viewing probes, not claims about a saved UI pose.
 for(const [index,window] of data.windows.entries()){
  const a=m.coord(window[0],window[1]),b=m.coord(window[2],window[3]);
  const center=[(a[0]+b[0])/2,(a[1]+b[1])/2],d=new T.Vector2(b[1]-a[1],-(b[0]-a[0])).normalize();
  if(d.dot(new T.Vector2(...center))<0)d.negate();
  const spec={name:`apartment-${id}-window${index+1}-far1400`,position:world(center[0]-d.x*.4,1.65,center[1]-d.y*.4),target:world(center[0]+d.x*20,1.65,center[1]+d.y*20),fov:70,aspect:1.5,near:.035,far:1400};
  aptWindowSpecs.push(spec);cameraSpecs.push(spec);
 }
}
const suns=[{name:'summer-noon',azimuth:180,elevation:57.65},{name:'winter-noon',azimuth:173.38,elevation:10.71},{name:'low-east',azimuth:90,elevation:.25},{name:'low-west',azimuth:270,elevation:.25}];
const shots=[];
let maxReceiverOutside=0,maxCasterDepthOutside=0;
const corners=box=>{const a=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])a.push(new T.Vector3(x,y,z));return a;};
for(const spec of cameraSpecs){
 const camera=new T.PerspectiveCamera(spec.fov,spec.aspect,spec.near,spec.far);camera.position.fromArray(spec.position);camera.lookAt(...spec.target);camera.updateWorldMatrix(true,false);
 const apartmentID=Object.keys(apartmentBounds).find(id=>spec.name.startsWith(`apartment-${id}-`));
 const shotRegions=apartmentID?{...regions,apartmentOnly:apartmentBounds[apartmentID].receiverBounds}:regions;
 const allCasterBounds=apartmentID?apartmentBounds[apartmentID].casterBounds:filtered.casterBounds;
 for(const [name,region] of Object.entries(shotRegions)){
  const light=new T.DirectionalLight();light.shadow.mapSize.set(4096,4096);
  const fitter=createSolarShadowCameraFitter(light,{casterBounds:allCasterBounds,receiverBounds:region});
  for(const sun of suns){
   const state=fitter.fit({camera,direction:direction(sun.azimuth,sun.elevation)}),intersection=solarShadowReceiverPoints(camera,region);
   for(const p of intersection.points){const clip=p.clone().project(light.shadow.camera),out=Math.max(0,Math.abs(clip.x)-1,Math.abs(clip.y)-1,Math.abs(clip.z)-1);maxReceiverOutside=Math.max(maxReceiverOutside,out);assert.ok(out<1e-7,'Every visible point in the selected full-height receiver region remains inside the shadow map');}
   for(const p of corners(allCasterBounds)){const depth=-p.applyMatrix4(light.shadow.camera.matrixWorldInverse).z,out=Math.max(0,state.near-depth,depth-state.far);maxCasterDepthOutside=Math.max(maxCasterDepthOutside,out);assert.ok(out<1e-7,'Full actual caster depth is retained for every region');}
   shots.push({camera:spec.name,region:name,sun:sun.name,width:state.width,height:state.height,texelWorld4096:state.texelWorld[0],texelWorld2048:state.width/2048,texelWorld1024:state.width/1024,receiverVisible:state.receiverVisible,receiverVertices:state.receiverVertexCount,far:state.far});
  }
 }
}
const sky=records.filter(r=>r.object.isInstancedMesh&&isSky(r.object)).map(r=>({name:r.object.name,path:path(r.object),kind:skyKinds.get(r.object.geometry),instanced:r.object.isInstancedMesh,count:r.object.count,cast:r.object.castShadow,receive:r.object.receiveShadow,excludeFromSolarShadow:r.object.userData.excludeFromSolarShadow===true,bounds:boxJSON(r.box)}));
const regionApis={};
for(const [name,value] of Object.entries(model.neighborhood))if(value&&typeof value==='object'&&!Array.isArray(value)&&!value.isObject3D){
 const objects=plainObjects(value);if(objects.length)regionApis[name]=objects.map(describe);
}
const report={pass:true,createdAt:new Date().toISOString(),elapsedMS:performance.now()-started,readOnly:true,units:'world; 1 world unit = 1.1099621032624687 m',inputSHA:Object.fromEntries(['complex-model.js','complex-life.js','neighborhood.js','solar-shadow-camera.js','apartment-plans.js','apartment-model.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL(`../../dist/${name}`,import.meta.url))).digest('hex')])),excludedObjects:{ground:describe(giant),sky},fullCasterBounds:boxJSON(full.casterBounds),filteredCasterBounds:boxJSON(filtered.casterBounds),regions:Object.fromEntries(Object.entries(regions).map(([name,box])=>[name,{...boxJSON(box),padding:.5,coverage:regionCoverage[name]}])),apartmentBounds:Object.fromEntries(Object.entries(apartmentBounds).map(([id,b])=>[id,{receiverBounds:boxJSON(b.receiverBounds),fullCasterBounds:boxJSON(b.casterBounds),metadata:b.metadata}])),topLevel:model.root.children.map(describe),neighborhoodChildren:model.neighborhood.group.children.map(describe),forestChildren:model.neighborhood.forestGroup.children.map(describe),regionApis,roadsideObjectCount:roadsideObjects.length,localAccessObjectCount:localAccessObjects.length,cameraSpecs,windowProbeNote:'Derived probe poses at actual window centres with approximate outward direction. They are not recorded UI camera poses.',suns,shots,maxReceiverOutside,maxCasterDepthOutside};
const output=new URL('./shadow-camera-regions.json',import.meta.url);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,regions:report.regions,sky:report.excludedObjects.sky,topLevel:report.topLevel.map(r=>({name:r.name,receivers:r.receivers})),selectedShots:shots.filter(s=>['walk-actual-far900','forecourt-source','apartment-1-59-overview-far1400','apartment-1-81-overview-far1400'].includes(s.camera)&&s.sun==='winter-noon'),checks:shots.length,maxReceiverOutside,maxCasterDepthOutside,output:output.pathname},null,2));
model.dispose();
