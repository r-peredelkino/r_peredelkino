// @r_peredelkino · RP-CONCEPT-2026-10-07 · showroom-only section acceptance.
// CPU rays exercise the same source model, clone and adapted gym as the showroom.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const url=name=>pathToFileURL(path.join(root,'dist',name)).href;
const T=await import(url('vendor/three.module.js'));
const {createComplex}=await import(url('complex-model.js'));
const {applyFitnessContextCut}=await import(url('fitness-context-cut-v35.js'));
const {createOfficeFitness,registerFitnessSourceZone}=await import(url('office-fitness-v35.js'));
const {complexFootprints:f}=await import(url('complex-footprints.js'));
const {arenaCenter,arenaGroundRadius}=await import(url('arena-placement-v35.js'));
const {courtyardPassage}=await import(url('courtyard-passage.js'));
const {insideRing,solidContains,segmentDistance}=await import(url('walk-physics.js'));
const checks=[],add=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const digest=a=>createHash('sha256').update(bytes(a)).digest('hex');
const model=createComplex(),spec=model.towers.get(0).spec;
model.root.updateMatrixWorld(true);
const sourceRings=JSON.stringify(f),sourceGeometries=new Map(),sourceMaterials=new Map(),sourceInstances=new Map(),bindings=[],disposeEvents={geometry:0,material:0,texture:0},sourceTextures=new Map();
const matState=m=>JSON.stringify({color:m.color?.getHex(),emissive:m.emissive?.getHex(),opacity:m.opacity,transparent:m.transparent,side:m.side,roughness:m.roughness,metalness:m.metalness,depthWrite:m.depthWrite,visible:m.visible,map:m.map?.uuid,bumpMap:m.bumpMap?.uuid,normalMap:m.normalMap?.uuid,envMap:m.envMap?.uuid});
const geoState=g=>JSON.stringify({attributes:Object.entries(g.attributes).map(([n,a])=>[n,a.itemSize,a.normalized,digest(a.array)]),index:g.index?digest(g.index.array):null,groups:g.groups});
model.root.traverse(o=>{
 if(!o.isMesh)return;bindings.push({o,geometry:o.geometry,material:o.material});
 if(!sourceGeometries.has(o.geometry)){sourceGeometries.set(o.geometry,geoState(o.geometry));o.geometry.addEventListener('dispose',()=>disposeEvents.geometry++);}
 if(o.isInstancedMesh)sourceInstances.set(o,digest(o.instanceMatrix.array));
 for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(!sourceMaterials.has(m)){sourceMaterials.set(m,matState(m));m.addEventListener('dispose',()=>disposeEvents.material++);}
  for(const value of Object.values(m))if(value?.isTexture&&!sourceTextures.has(value)){sourceTextures.set(value,value.image?.data?digest(value.image.data):null);value.addEventListener('dispose',()=>disposeEvents.texture++);}
 }
});
let originalRejected=false;try{applyFitnessContextCut(model.root,{model,spec});}catch(e){originalRejected=e instanceof TypeError;}
add('The helper rejects the original exterior model',originalRejected);
const clone=model.root.clone(true),externalOwned=new Set();clone.getObjectByName('Office 0').visible=false;
const sourceWindow=model.commercialFrontage.shopWindows,cloneWindow=clone.getObjectByName(sourceWindow.name),windowBefore=cloneWindow.instanceMatrix.array.slice();
const result=applyFitnessContextCut(clone,{model,spec,ownedGeometries:externalOwned}),meta=result.metadata;
clone.updateMatrixWorld(true);
const names=[
 'Unified commercial ground floor including cyber arena',
 'Ground mineral plinth below the commercial volumes',
 'Upper commercial volume meeting the unchanged arena shoulders',
 'Continuous white commercial cornice abutting the arena capsule',
 'Podium roof slab closed against the rounded arena',
 'Continuous white band joining the podium and projecting arena',
 'Exposed gravel roof under the separate furnished terraces'
];
const ring=spec.shape.map(([x,z])=>[spec.x+x,spec.z+z]),sourceVolumes=names.map(n=>model.root.getObjectByName(n)),cloneVolumes=names.map(n=>clone.getObjectByName(n));
const nearOffice=(x,z,margin=1)=>insideRing(x,z,ring)||ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<margin);
add('The cut uses the exact retained office-0 world contour',JSON.stringify(meta.officeRing)===JSON.stringify(ring)&&meta.officeId===0&&meta.revision===36,{vertices:ring.length,bounds:meta.officeRingBounds});
add('All seven coordinated volumes are replaced in the clone only',meta.replacements.length===7&&names.every((n,i)=>meta.replacements.some(r=>r.name===n)&&cloneVolumes[i].geometry!==sourceVolumes[i].geometry&&cloneVolumes[i].material===sourceVolumes[i].material),{replacements:meta.replacements});
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const opaque=h=>{const material=Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex||0]:h.object.material;return visible(h.object)&&material?.visible!==false&&(!material?.transparent||material.opacity>.8);};
function ray(a,b,objects,{opaqueOnly=true}={}){
 const origin=new T.Vector3(...a),target=new T.Vector3(...b),direction=target.clone().sub(origin),distance=direction.length();
 return new T.Raycaster(origin,direction.normalize(),0,distance+1e-5).intersectObjects(objects,true).filter(h=>!opaqueOnly||opaque(h));
}
const top=(o,x,z,from=10,to=0)=>ray([x,from,z],[x,to,z],[o]).map(h=>h.point.y);
const register=registerFitnessSourceZone(spec),gym=createOfficeFitness({model,spec,floorY:.24});gym.ceiling.visible=false;gym.group.updateMatrixWorld(true);
// Actual first-floor window rays exercise the previous coplanar dark-wall failure.
// We use the final batched glazing geometry, not its material or recess metadata.
const gymGlass=gym.group.getObjectByName('Panoramic glazing following the source polygon');
const glazingRays=[-86,-83,-80,-77,-74,-71,-68].map(z=>{
 const start=[54,1.92,z],end=[83,1.92,z],wall=ray(start,end,[cloneVolumes[0]])[0],glass=gymGlass?ray(start,end,[gymGlass],{opaqueOnly:false})[0]:null;
 return{z,eye:start,cutFace:wall?.point.toArray(),glazing:glass?.point.toArray(),gap:wall&&glass?wall.distance-glass.distance:null,glassFirst:!!wall&&!!glass&&glass.distance<wall.distance};
});
add('Seven real eye rays keep recessed glazing clear of the retained ground cut face',glazingRays.every(r=>r.glassFirst&&r.gap>=.015&&r.gap<=.035),{rayCount:glazingRays.length,rays:glazingRays});
let glazingVertices=0,outsideGlazingVertices=0;const glassPosition=gymGlass?.geometry.attributes.position;
if(glassPosition)for(let i=0;i<glassPosition.count;i++){const p=new T.Vector3().fromBufferAttribute(glassPosition,i).applyMatrix4(gymGlass.matrixWorld);glazingVertices++;if(!insideRing(p.x,p.z,ring))outsideGlazingVertices++;}
add('All final glazing vertices stay inside the office and cast no opaque window shadows',glazingVertices>=2000&&outsideGlazingVertices===0&&gymGlass.castShadow===false&&gymGlass.receiveShadow===false,{vertices:glazingVertices,outsideVertices:outsideGlazingVertices,castShadow:gymGlass?.castShadow,receiveShadow:gymGlass?.receiveShadow});
// Valid downward rays start above the original roof; their paths cross its top.
// A short ray with both endpoints inside the old solid would be a false proof.
const officeSamples=[];for(let x=meta.officeRingBounds[0]+1;x<meta.officeRingBounds[1];x+=2)for(let z=meta.officeRingBounds[2]+1;z<meta.officeRingBounds[3];z+=2){
 if(!insideRing(x,z,ring)||ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<.6))continue;officeSamples.push([x,z]);
}
let sourceRoofHits=0,cutRoofHits=0;for(const [x,z]of officeSamples){if(ray([x,12,z],[x,.22,z],sourceVolumes).length)sourceRoofHits++;if(ray([x,12,z],[x,.22,z],cloneVolumes).length)cutRoofHits++;}
add('Real roof-to-floor rays clear the complete office section',officeSamples.length>80&&sourceRoofHits>50&&cutRoofHits===0,{samples:officeSamples.length,sourceBlockingSamples:sourceRoofHits,cloneBlockingSamples:cutRoofHits});
const oldOverview=ray(gym.overview.position,gym.overview.target,[model.root]),newOverview=ray(gym.overview.position,gym.overview.target,[clone]);
add('The actual gym overview clears the original gravel/slab occlusion',oldOverview.length>0&&newOverview.length===0,{position:gym.overview.position,target:gym.overview.target,sourceFirst:oldOverview[0]?{name:oldOverview[0].object.name,y:oldOverview[0].point.y}:null,cloneHits:newOverview.map(h=>h.object.name)});
const machineRays=[];gym.group.traverse(machine=>{
 if(!machine.userData.equipmentId)return;const candidates=[];
 machine.traverse(o=>{
  if(!o.isMesh||!visible(o))return;const position=o.geometry.attributes.position,index=o.geometry.index,count=(index?.count||position.count)/3;
  for(let triangle=0;triangle<count;triangle+=Math.max(1,Math.floor(count/16))){
   const p=new T.Vector3();for(let j=0;j<3;j++)p.add(new T.Vector3().fromBufferAttribute(position,index?index.getX(triangle*3+j):triangle*3+j));p.multiplyScalar(1/3).applyMatrix4(o.matrixWorld);candidates.push(p.toArray());
  }
 });
 let proof=null;for(const target of candidates){
  const equipment=ray(gym.overview.position,target,[gym.group]),first=equipment[0];if(!first)continue;
  let owner=first.object;while(owner&&owner!==machine&&owner!==gym.group)owner=owner.parent;
  if(owner!==machine)continue;const context=ray(gym.overview.position,first.point.toArray(),[clone]);
  if(context.length)continue;proof={point:first.point.toArray(),name:first.object.name};break;
 }
 machineRays.push({id:machine.userData.equipmentId,candidateSurfacePoints:candidates.length,equipmentVisible:!!proof,...(proof?{visibleSurface:proof}:{})});
});
add('The overview reaches actual authored equipment surfaces without an exterior blocker',machineRays.length>=8&&machineRays.filter(r=>r.equipmentVisible).length>=6,{equipmentRays:machineRays});
const eye=[gym.walker.x,1.92,gym.walker.z],eyeRays=gym.metadata.workingFootprints.map(m=>({id:m.id,hits:ray(eye,[m.x,.24+m.viewTargetHeight,m.z],cloneVolumes).map(h=>h.object.name)}));
add('Floor-1 main-aisle eye rays have no erroneous podium inside the office',eyeRays.every(r=>r.hits.length===0)&&gym.world.free(gym.walker.x,gym.walker.z),{eye,sourceFloor:gym.metadata.sourceFloor,adaptedFloor:gym.metadata.adaptedFloor,eyeRays});
// The adjacent occupied podium is deliberately retained, even when it limits
// an eastward floor-1 street view. Check real long rays reaching that neighbour.
const eastVistas=[-9,-5,0,6].map(u=>{const {origin,along,normal}=register.frame,p=[origin[0]+along[0]*u-normal[0],1.92,origin[1]+along[1]*u-normal[1]],end=[p[0]+normal[0]*30,p[1],p[2]+normal[1]*30],a=ray(end,p,[sourceVolumes[0]])[0],b=ray(end,p,[cloneVolumes[0]])[0],insideHits=ray(p,end,[cloneVolumes[0]]);return{u,sourceExterior:a?.point.toArray(),cloneExterior:b?.point.toArray(),cloneCutFace:insideHits[0]?.point.toArray(),same:!!a&&!!b&&a.point.distanceTo(b.point)<.002};});
add('Long rays retain the genuine adjacent ground-storey podium exterior and limited floor-1 view',eastVistas.every(v=>v.same&&v.cloneCutFace),{vistas:eastVistas,viewLimit:meta.viewLimit});
let neighbourSamples=0,neighbourErrors=[];for(let x=-85;x<85;x+=4)for(let z=-110;z<90;z+=4){
 if(nearOffice(x,z)||Math.hypot(x-arenaCenter[0],z-arenaCenter[1])<arenaGroundRadius+2||!solidContains(x,z,f.podium))continue;
 neighbourSamples++;for(let i=0;i<cloneVolumes.length;i++){
  const a=top(sourceVolumes[i],x,z),b=top(cloneVolumes[i],x,z);if(a.length!==b.length||a.some((y,j)=>Math.abs(y-b[j])>.002))neighbourErrors.push({x,z,name:names[i],source:a,clone:b});
 }
}
add('Neighbouring podium, fascia, cornice, slab and gravel retain their source heights',neighbourSamples>100&&neighbourErrors.length===0,{samples:neighbourSamples,errors:neighbourErrors.slice(0,12)});
let arenaSamples=0,arenaErrors=0;for(let i=0;i<192;i++){
 const angle=(i+.5)/192*Math.PI*2,x=arenaCenter[0]+Math.cos(angle)*(arenaGroundRadius-.08),z=arenaCenter[1]+Math.sin(angle)*(arenaGroundRadius-.08);
 if(solidContains(x,z,f.podium))continue;arenaSamples++;
 const a=top(model.arenaExterior.arena,x,z,4.02,2.9),b=top(cloneVolumes[0],x,z,4.02,2.9);if(!a.length||!b.length||Math.abs(a[0]-b[0])>.002)arenaErrors++;
}
add('The clone ground union preserves contact with the far projecting arena',arenaSamples>60&&arenaErrors===0,{outboardArcSamples:arenaSamples,errors:arenaErrors,arenaSourceGeometryShared:clone.getObjectByName(model.arenaExterior.arena.name).geometry===model.arenaExterior.arena.geometry});
const [px,pz]=courtyardPassage.centre,normal=courtyardPassage.normal,a=[px+normal[0]*3,1.5,pz+normal[1]*3],b=[px-normal[0]*(courtyardPassage.outside+1),1.5,pz-normal[1]*(courtyardPassage.outside+1)];
add('The genuine K1–K2 ground passage is retained by the regenerated ground',ray(a,b,[cloneVolumes[0]]).length===0&&ray(a,b,[sourceVolumes[0]]).length===0,{start:a,end:b});
const actuallyHidden=[],unexpectedChanges=[];for(let i=0;i<cloneWindow.count;i++){
 const start=i*16,changed=cloneWindow.instanceMatrix.array.slice(start,start+16).some((v,j)=>v!==windowBefore[start+j]);if(changed){actuallyHidden.push(i);const matrix=cloneWindow.instanceMatrix.array.slice(start,start+16);if(matrix[0]!==0||matrix[5]!==0||matrix[10]!==0)unexpectedChanges.push(i);}
}
add('Only listed office-local clone shop instances are suppressed',actuallyHidden.length>0&&JSON.stringify(actuallyHidden)===JSON.stringify(meta.hiddenShopInstances)&&unexpectedChanges.length===0&&cloneWindow.instanceMatrix!==sourceWindow.instanceMatrix,{hiddenIndices:actuallyHidden,independentMatrixBuffer:cloneWindow.instanceMatrix.array.buffer!==sourceWindow.instanceMatrix.array.buffer});
let invalid=0,stamped=0;for(const g of externalOwned){for(const name of ['position','normal','uv'])for(const v of g.attributes[name].array)if(!Number.isFinite(v))invalid++;if(g.attributes.rpAuthor&&g.userData.fitnessContextCut?.cloneOnly)stamped++;}
add('Owned replacement and local-frame geometry is finite and attributed',invalid===0&&stamped===externalOwned.size&&externalOwned.size>=10,{geometries:externalOwned.size,stamped,invalid,localFrameFilters:meta.frameFilters});
const sourceIntact=()=>({geometry:[...sourceGeometries].every(([g,s])=>geoState(g)===s),materials:[...sourceMaterials].every(([m,s])=>matState(m)===s),instances:[...sourceInstances].every(([o,s])=>digest(o.instanceMatrix.array)===s),bindings:bindings.every(b=>b.o.geometry===b.geometry&&b.o.material===b.material),textures:[...sourceTextures].every(([t,s])=>!s||digest(t.image.data)===s),rings:JSON.stringify(f)===sourceRings});
const intactBefore=sourceIntact();add('All original attribute arrays, materials, textures, instances and contour data remain exact',Object.values(intactBefore).every(Boolean),intactBefore);
const ownedBefore=[...externalOwned],ownDisposes=new Map(ownedBefore.map(g=>[g,0]));for(const g of ownedBefore)g.addEventListener('dispose',()=>ownDisposes.set(g,ownDisposes.get(g)+1));
result.dispose();result.dispose();const intactAfter=sourceIntact();
add('Repeated helper disposal releases each owned geometry exactly once',externalOwned.size===0&&[...ownDisposes.values()].every(n=>n===1),{ownedGeometries:ownedBefore.length,disposeCounts:[...ownDisposes.values()],externalSetSize:externalOwned.size});
add('Helper disposal never releases or changes any exterior source resource',Object.values(disposeEvents).every(n=>n===0)&&Object.values(intactAfter).every(Boolean),{sourceDisposeEvents:disposeEvents,sourceState:intactAfter});
const report={revision:36,report:'fitness-context-cpu',pass:checks.every(c=>c.pass),checks,metadata:meta};
const output=process.env.RP_QA_OUTPUT||(process.env.RP_QA_OUT?path.join(process.env.RP_QA_OUT,'fitness-context-cpu.json'):path.join(root,'tools','qa-v36','fitness-context-cpu.json'));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.map(({name,pass,details})=>({name,pass,...(!pass?{details}: {})})),output},null,2));
gym.dispose();clone.traverse(o=>{if(o.isInstancedMesh)o.dispose();});model.dispose();if(!report.pass)process.exitCode=1;
