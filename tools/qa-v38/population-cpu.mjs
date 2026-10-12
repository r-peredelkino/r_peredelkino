// Real courtyard circulation, continuous actor motion, instance batching and lifetime.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const url=name=>pathToFileURL(path.join(project,'dist',name)).href;
const T=await import(url('vendor/three.module.js'));
const {createComplex}=await import(url('complex-model.js'));
const {attachCyberExperience}=await import(url('cyber-experience.js'));
const {createPedestrianNavigation}=await import(url('pedestrian-navigation-v38.js'));
const {frontageGroundHeight}=await import(url('forecourt-ground.js'));
const {createComplexLife}=await import(url('complex-life.js'));
const {poseLifeActor}=await import(url('life-actors-v38.js'));
const checks=[],check=(name,pass,details={})=>{checks.push({name,pass:!!pass,...details});if(!pass)throw Error(name+' '+JSON.stringify(details));};
const model=createComplex();attachCyberExperience(model);const nav=createPedestrianNavigation(model),life=model.life;
const source=JSON.stringify(Array.from(model.towers.values(),t=>({spec:t.spec,panes:Array.from(t.windows.instanceMatrix.array),shape:t.shape.getPoints(32)})));
const started=performance.now();life.setNavigation(nav);const planningMs=performance.now()-started;
check('All seven roles are alive on verified ground routes or real benches',life.stats.actors===52&&life.stats.active===52&&Object.values(life.stats.roles).every(r=>r.active===r.total),{stats:life.stats,planningMs});
check('Dogs, couriers, bicycles and six-wheel robots are articulated original meshes',life.actors.filter(a=>a.dog).length===6&&life.actors.filter(a=>a.bike).length===10&&life.actors.filter(a=>a.robot).length===4&&life.actors.filter(a=>a.robot).every(a=>a.robot.wheels.length===6)&&life.actors.filter(a=>a.role==='courier').every(a=>a.person.g.userData.role==='courier'));
let maxHandGap=0,maxSoleHeightGap=0,maxSoleForeGap=0,maxPedalTilt=0;const handPoint=new T.Vector3(),solePoint=new T.Vector3(),pedalPoint=new T.Vector3(),handlePoint=new T.Vector3(),up=new T.Vector3(),rotation=new T.Quaternion();
for(const actor of life.actors.filter(a=>a.bike)){
 const savedMotion=actor.motionTime;
 for(let frame=0;frame<=48;frame++){
  actor.motionTime=frame/48*Math.PI*2*.31/actor.speed;poseLifeActor(actor,life.time);actor.g.updateMatrixWorld(true);
  for(let side=0;side<2;side++){
   actor.person.elbows[side].children[2].getWorldPosition(handPoint);actor.g.worldToLocal(handPoint);handlePoint.set(side===0?-.26:.26,1.04,.54);maxHandGap=Math.max(maxHandGap,handPoint.distanceTo(handlePoint));
   actor.person.legs[side].foot.children[1].getWorldPosition(solePoint);actor.g.worldToLocal(solePoint);actor.bike.pedalPlatforms[side].getWorldPosition(pedalPoint);actor.g.worldToLocal(pedalPoint);
   maxSoleHeightGap=Math.max(maxSoleHeightGap,Math.abs(solePoint.y-pedalPoint.y-.0245));maxSoleForeGap=Math.max(maxSoleForeGap,Math.abs(solePoint.z-pedalPoint.z));
   actor.bike.pedalPlatforms[side].getWorldQuaternion(rotation);up.set(0,1,0).applyQuaternion(rotation);maxPedalTilt=Math.max(maxPedalTilt,Math.abs(1-up.y));
  }
 }
 actor.motionTime=savedMotion;poseLifeActor(actor,life.time);
}
check('Cyclists and couriers physically grip their actual handlebars',maxHandGap<.035,{maxHandGap});
check('A complete pedal revolution retains flat platforms and exact shoe-sole contact',maxSoleHeightGap<1e-7&&maxSoleForeGap<1e-7&&maxPedalTilt<1e-7,{maxSoleHeightGap,maxSoleForeGap,maxPedalTilt,phases:49,bicycles:10});
check('Only safe polyline routes are used for all moving roles',life.actors.every(a=>!a.route||a.route.interpolation==='polyline'&&a.route.drawSurface===false&&nav.validateRoute(a.route,{radius:a.radius})));
check('Cyclists retain a 0.95 m envelope and dogs/robots a 0.75 m envelope',life.actors.filter(a=>a.bike).every(a=>a.radius===.95)&&life.actors.filter(a=>a.dog||a.robot).every(a=>a.radius===.75));
const seats=life.actors.filter(a=>a.role==='seated');
check('Seated conversations follow actual bench surfaces and clear visitor centres',seats.length===6&&seats.every(a=>a.bench&&Math.hypot(a.g.position.x-a.bench.point[0],a.g.position.z-a.bench.point[1])>.45&&Math.abs(a.g.rotation.y-a.bench.yaw)<1e-8));
let seatContactGap=0,seatedSoleGap=0;const contactBounds=new T.Box3();
for(const actor of seats){actor.g.updateMatrixWorld(true);contactBounds.setFromObject(actor.person.g.children[0]);seatContactGap=Math.max(seatContactGap,Math.abs(contactBounds.min.y-actor.seatSurfaceHeight));for(const leg of actor.person.legs){contactBounds.setFromObject(leg.foot.children[1]);seatedSoleGap=Math.max(seatedSoleGap,Math.abs(contactBounds.min.y-frontageGroundHeight(actor.g.position.x,actor.g.position.z)-.035));}}
check('Rendered pelvis rests on the timber and rendered seated soles meet paving',seatContactGap<.001&&seatedSoleGap<.001,{seatContactGap,seatedSoleGap});
check('Fifty-two actors use at most 18 opaque draw batches',life.stats.actorDrawBatches<=18&&life.group.children.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.visible).length===0,{drawBatches:life.stats.actorDrawBatches});
const positions=new Map(life.actors.map(a=>[a,{p:a.g.position.clone(),distance:a.distance}]));
let collisions=0,dogCollisions=0,unsafeSteps=0,wrongHeight=0,samples=0;
life.update(0);
for(let frame=1;frame<=1200;frame++){
 life.update(frame/30);
 for(const actor of life.actors){if(!actor.route)continue;const prev=positions.get(actor),p=actor.g.position;samples++;
  if(!actor.world.free(p.x,p.z))collisions++;
  if(Math.hypot(p.x-prev.p.x,p.z-prev.p.z)>actor.speed/30+.0001)unsafeSteps++;
  if(Math.abs(p.y-frontageGroundHeight(p.x,p.z)-.035)>.0001)wrongHeight++;
  if(actor.dog){const d=actor.dog.worldPosition;if(!d||!actor.world.free(d.x,d.z))dogCollisions++;}
  prev.p.copy(p);
 }
}
check('Forty seconds of real actor movement never crosses shrubs, furnishings or source architecture',collisions===0&&dogCollisions===0&&unsafeSteps===0&&wrongHeight===0,{samples,collisions,dogCollisions,unsafeSteps,wrongHeight});
check('Every moving role advances continuously rather than freezing on a rejected route',life.actors.filter(a=>a.route).every(a=>Math.abs(a.distance-positions.get(a).distance)>a.speed*35&&!a.blocked),{blocked:life.actors.filter(a=>a.blocked).map(a=>a.g.userData.actorId)});
const finiteMeshes=[];life.group.traverse(o=>{if(o.isInstancedMesh)finiteMeshes.push(o);});
check('All articulated batch matrices remain finite',finiteMeshes.every(o=>Array.from(o.instanceMatrix.array).every(Number.isFinite)));
const beforePause=JSON.stringify(life.actors.map(a=>({p:a.g.position.toArray(),head:a.person?.head.rotation.toArray(),pedals:a.bike?.pedals.rotation.toArray(),wheels:a.robot?.wheels.map(w=>w.rotation.toArray())}))),pauseClock=life.time,pauseBuffers=finiteMeshes.map(o=>o.instanceMatrix.array.slice());
life.setEnabled(false);for(let frame=1201;frame<=1260;frame++)life.update(frame/30);
check('Pause freezes route positions, all limbs/wheels, sky clock and uploaded matrices',life.time===pauseClock&&JSON.stringify(life.actors.map(a=>({p:a.g.position.toArray(),head:a.person?.head.rotation.toArray(),pedals:a.bike?.pedals.rotation.toArray(),wheels:a.robot?.wheels.map(w=>w.rotation.toArray())})))===beforePause&&finiteMeshes.every((o,i)=>o.instanceMatrix.array.every((n,j)=>n===pauseBuffers[i][j])));
life.setEnabled(true);const clock=life.time,first=life.actors.find(a=>a.role==='runner'),d=first.distance;life.update(10000);
check('A tab gap is capped to 80 ms and cannot teleport a running resident',Math.abs(life.time-clock-.08)<1e-8&&Math.abs(Math.abs(first.distance-d)-first.speed*.08)<1e-7);
const routeIdentities=life.actors.map(a=>a.route),distances=life.actors.map(a=>a.distance);
const submittedInstances=[];
for(const id of['fast','balanced','full','max']){life.setQuality(id);submittedInstances.push({id,count:finiteMeshes.filter(m=>m.userData.populationBatch).reduce((n,m)=>n+m.count,0)});check(id+' preserves every role and route state while choosing a bounded population',Object.values(life.stats.roles).every(r=>r.visible>0&&r.visible<=r.active)&&life.actors.every((a,i)=>a.route===routeIdentities[i]&&a.distance===distances[i])&&life.stats.quality.updateHz>=15&&life.stats.quality.updateHz<=40,{roles:life.stats.roles,quality:life.stats.quality});}
check('Economy and balanced profiles submit fewer real GPU instances',submittedInstances[0].count<submittedInstances[1].count&&submittedInstances[1].count<submittedInstances[2].count&&submittedInstances[2].count===submittedInstances[3].count,{submittedInstances});
life.setQuality({id:'fast',population:NaN,updateHz:Infinity});check('Malformed quality numbers fall back to the preset',life.stats.quality.population===.45&&life.stats.quality.updateHz===15);
life.setQuality('full');life.setEnabled(false);const camera=new T.PerspectiveCamera();camera.position.copy(first.g.position).add(new T.Vector3(0,1.68,0));life.setViewer(camera);life.update(10001);
check('Walking past a paused landscape still hides nearby figures from the camera',first.g.userData.hideNearViewer===true);
model.cyberCourtyard.setVisible(false);life.update(10002);check('Turning off the authored bench layer hides its seated occupants',seats.every(a=>a.g.userData.ownerHidden));model.cyberCourtyard.setVisible(true);
life.setViewer(null);life.update(10003);
const seatSwitchReports=[];let seatSwitchStamp=10003;
for(const profile of['fast','full']){
 life.setQuality(profile);life.setEnabled(true);seatSwitchStamp+=1/120;life.update(seatSwitchStamp);life.setEnabled(false);const batches=finiteMeshes.filter(m=>m.userData.populationBatch),beforeCount=batches.reduce((n,m)=>n+m.count,0),visibleSeats=life.stats.roles.seated.visible,clock=life.time,active=life.stats.active;
 const matrixBuffers=batches.map(m=>m.instanceMatrix.array.slice()),colourBuffers=batches.map(m=>m.instanceColor.array.slice()),batchIdentities=life.group.children.filter(m=>m.isInstancedMesh);
 const poses=JSON.stringify(seats.map(a=>({position:a.g.position.toArray(),rotation:a.g.rotation.toArray(),head:a.person.head.rotation.toArray(),legs:a.person.legs.map(l=>({hip:l.pivot.rotation.toArray(),knee:l.bend.rotation.toArray(),foot:l.foot.rotation.toArray()}))})));
 let seatedParts=0;for(const actor of seats.filter(a=>a.active&&a.qualityVisible))actor.g.traverse(mesh=>{if(mesh.isMesh)seatedParts++;});
 const switchedOff=life.setSeatingVisible(false),offCount=batches.reduce((n,m)=>n+m.count,0);
 const offPass=switchedOff&&!life.setSeatingVisible(false)&&seats.every(a=>!a.g.visible&&a.g.userData.seatingHidden)&&life.stats.roles.seated.visible===0&&life.stats.roles.seated.active===6&&life.stats.active===active&&active===52&&life.time===clock&&offCount===beforeCount-seatedParts;
 const switchedOn=life.setSeatingVisible(true),onCount=batches.reduce((n,m)=>n+m.count,0);
 const onPass=switchedOn&&!life.setSeatingVisible(true)&&seats.every(a=>a.g.visible&&!a.g.userData.seatingHidden)&&life.stats.roles.seated.visible===visibleSeats&&life.stats.active===active&&life.time===clock&&onCount===beforeCount&&batches.every((m,i)=>m.instanceMatrix.array.every((v,j)=>v===matrixBuffers[i][j])&&m.instanceColor.array.every((v,j)=>v===colourBuffers[i][j]))&&batchIdentities.every((m,i)=>m===life.group.children.filter(o=>o.isInstancedMesh)[i])&&poses===JSON.stringify(seats.map(a=>({position:a.g.position.toArray(),rotation:a.g.rotation.toArray(),head:a.person.head.rotation.toArray(),legs:a.person.legs.map(l=>({hip:l.pivot.rotation.toArray(),knee:l.bend.rotation.toArray(),foot:l.foot.rotation.toArray()}))})));
 seatSwitchReports.push({profile,offPass,onPass,beforeCount,offCount,onCount,seatedParts,visibleSeats,clock});
}
check('The courtyard seating switch removes only real seated GPU parts immediately while paused',seatSwitchReports.every(r=>r.offPass),{profiles:seatSwitchReports});
check('Restoring seating retains exact poses, quality budgets, buffers and existing draw batches',seatSwitchReports.every(r=>r.onPass),{profiles:seatSwitchReports});
check('Life never changes a tower, source contour or facade pane matrix',source===JSON.stringify(Array.from(model.towers.values(),t=>({spec:t.spec,panes:Array.from(t.windows.instanceMatrix.array),shape:t.shape.getPoints(32)}))));
const standaloneRoot=new T.Group(),standalone=createComplexLife(standaloneRoot),events=new Map();standalone.group.traverse(o=>{for(const resource of[o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(resource&&!events.has(resource)){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}});standalone.pathMaterial.addEventListener('dispose',()=>events.set(standalone.pathMaterial,(events.get(standalone.pathMaterial)||0)+1));
standalone.dispose();standalone.dispose();standalone.update(5);check('Owned geometry and materials dispose exactly once and leave no root objects',standaloneRoot.children.length===0&&[...events.values()].every(n=>n===1),{resources:events.size,bad:[...events].filter(([,n])=>n!==1).map(([r,n])=>({type:r.type,n}))});
// An impossible planner produces an explicit zero population rather than an
// unvalidated frozen crowd at a default (0,0) position.
const empty=createComplexLife(new T.Group()),blockedWorld={free:()=>false};empty.setNavigation({routes:[],routesForRadius:()=>[],worldForRadius:()=>blockedWorld,nearest:()=>null,planPath:()=>null,validateRoute:()=>false,sampleRoute(){throw Error('unsafe route used');},benches:[]});
check('A disconnected scene never renders unvalidated fallback actors',empty.stats.active===0&&empty.actors.every(a=>!a.active));empty.dispose();
life.dispose();nav.dispose();model.dispose();
const report={revision:38,pass:checks.every(c=>c.pass),checkCount:checks.length,checks,samples,planningMs};
const dir=process.env.RP_QA_OUT||path.dirname(fileURLToPath(import.meta.url));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'population-cpu.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
