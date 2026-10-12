// Exercise physical routes, exact pose recovery, real fixture materials and owned media.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url)),url=n=>pathToFileURL(path.join(project,'dist',n)).href;
const T=await import(url('vendor/three.module.js'));
const {createApartment}=await import(url('apartment-model.js'));
const {apartmentPlans}=await import(url('apartment-plans.js'));
const {createApartmentActions}=await import(url('apartment-actions-v37.js'));
const {insideRing,segmentDistance}=await import(url('walk-physics.js'));
const {readPixelSignature}=await import(url('baked-authorship.js'));
const checks=[],models=[],coverage={},check=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const restTypes=new Set(['bed','sofa','lsofa','chair','toilet']);
function bfs(world,targets){
 const step=.06,start=world.start;if(!start)return{found:new Set(),count:0};const queue=[start],seen=new Set(['0,0']),found=new Set();
 for(let head=0;head<queue.length&&head<40000;head++){
  const p=queue[head];for(const target of targets)if(!found.has(target.id)&&Math.hypot(p.x-target.x,p.z-target.z)<step*1.5){const n=world.move(p,target.x-p.x,target.z-p.z);if(Math.hypot(n.x-target.x,n.z-target.z)<.00001)found.add(target.id);}
  for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){const x=p.x+dx,z=p.z+dz,k=Math.round((x-start.x)/step)+','+Math.round((z-start.z)/step);if(seen.has(k))continue;if(!world.free(x,z)){seen.add(k);continue;}const n=world.move(p,dx,dz);if(Math.hypot(n.x-x,n.z-z)<.00001){seen.add(k);queue.push({x,z});}}
 }
 return{found,count:queue.length};
}
function snapshotMaterial(m){return{map:m.map,emissiveMap:m.emissiveMap,color:m.color?.getHex(),emissive:m.emissive?.getHex(),emissiveIntensity:m.emissiveIntensity,toneMapped:m.toneMapped};}
function sameMaterial(m,s){return m.map===s.map&&m.emissiveMap===s.emissiveMap&&m.color?.getHex()===s.color&&m.emissive?.getHex()===s.emissive&&m.emissiveIntensity===s.emissiveIntensity&&m.toneMapped===s.toneMapped;}
for(const [id,data] of Object.entries(apartmentPlans)){
 const apartment=createApartment(id),originalMaps=new Map((apartment.interactionVisuals?.televisions??[]).map(v=>[v.index,snapshotMaterial(v.material)])),actions=createApartmentActions({apartment}),poses=actions.poi.filter(p=>p.action==='apartment-pose'),televisions=actions.visuals.televisions;
 const eligible=data.furniture.map((f,index)=>({type:f[0],index})).filter(f=>restTypes.has(f.type));
 const record={id,fixtures:poses.length,televisions:televisions.length,roomLights:actions.visuals.lights.length,diagnostics:actions.diagnostics};models.push(record);for(const f of eligible)coverage[f.type]=(coverage[f.type]||0)+1;
 check(id+' exposes every bed, sofa, chair and toilet individually',poses.length===eligible.length&&eligible.every(f=>poses.some(p=>p.fixtureIndex===f.index&&p.type===f.type))&&poses.every(p=>p.enabled),{eligible,poses:poses.map(p=>({id:p.id,room:p.room,enabled:p.enabled}))});
 check(id+' uses explicit Russian action cards',poses.every(p=>p.actionLabel===(p.type==='bed'?'Лечь на кровать':['sofa','lsofa'].includes(p.type)?'Лечь на диван':p.type==='chair'?'Сесть на стул':'Сесть на унитаз'))&&actions.poi.some(p=>p.id==='apt-lights'&&p.actionLabel==='Включить свет'));
 const fixtures=actions.poi.filter(p=>p.type!=='lights'),route=bfs(apartment.world,fixtures);
 check(id+' all furniture and TV approaches are collision-free and reached from the entrance',fixtures.every(p=>apartment.world.free(p.x,p.z)&&route.found.has(p.id)),{visited:route.count,unreachable:fixtures.filter(p=>!route.found.has(p.id)).map(p=>p.id)});
 const boundary=data.outline.map(p=>apartment.metrics.coord(...p)),segments=[...data.walls,...data.windows].map(a=>[apartment.metrics.coord(a[0],a[1]),apartment.metrics.coord(a[2],a[3])]);
 const bad=poses.filter(p=>{const [x,y,z]=p.pose.position,room=data.rooms[p.room];return!room||!insideRing(x,z,room.p.map(v=>apartment.metrics.coord(...v)))||!insideRing(x,z,boundary)||segments.some(([a,b])=>segmentDistance(x,z,a,b)<.1649)||!Number.isFinite(x+y+z+p.pose.yaw+p.pose.pitch)||y<.75||y>data.ceilingHeight-.15;});
 check(id+' each resting eye stays inside its actual room and clear of walls/glazing',bad.length===0,{bad:bad.map(p=>({id:p.id,pose:p.pose}))});
 check(id+' lying views stay above the cushions and seated views retain normal head height',poses.every(p=>p.pose.mode===(p.type==='chair'||p.type==='toilet'?'seated':'lying')&&(p.pose.mode==='lying'?p.pose.eyeHeight>=.85&&p.pose.eyeHeight<1:p.pose.eyeHeight>1.2&&p.pose.eyeHeight<1.4)&&p.pose.pitch>-.8&&p.pose.pitch<.9&&p.pose.pitchLimits[0]<p.pose.pitch&&p.pose.pitchLimits[1]>p.pose.pitch));
 check(id+' resting views use a brief fade rather than crossing partitions by camera interpolation',poses.every(p=>p.pose.transitionMode==='fade'&&p.pose.transitionDuration<=.20));
 const standing={x:apartment.world.start.x,z:apartment.world.start.z,yaw:.7123,pitch:-.122,eyeHeight:1.68,room:-1};
 const first=poses[0],last=poses.at(-1),chosen=actions.selectPose(first?.id,standing),saved=actions.savedStanding;
 check(id+' nearby activation checks a real visible approach and rejects outside/unknown targets',!!first&&actions.canInteract(first.id,{x:first.x,z:first.z},Infinity)&&!actions.canInteract(first.id,{x:999,z:999})&&!actions.canInteract('unknown',standing));
 if(id==='1-81'){const kitchen=apartment.metrics.coord(390,847),tv=actions.poi.find(p=>p.action==='apartment-tv'&&p.room===0);check('The family bedroom television cannot be toggled through the solid kitchen partition',apartment.world.free(...kitchen)&&!!tv&&!actions.canInteract(tv.id,{x:kitchen[0],z:kitchen[1]},2.2),{kitchen,tv:tv?.id});}
 if(last)actions.selectPose(last.id,{x:999,z:999,yaw:8,pitch:8});
 const restored=actions.restorePose();check(id+' changing furniture poses preserves and restores the exact initial walking pose',!!chosen&&JSON.stringify(saved)===JSON.stringify(standing)&&JSON.stringify(restored)===JSON.stringify(standing)&&actions.states.pose.mode==='standing'&&actions.savedStanding===null);
 const copy=actions.selectPose(first?.id,standing),copySaved=actions.savedStanding;if(copy){copy.position[0]=999;copySaved.x=999;}
 check(id+' caller mutations cannot change a resting target or its saved recovery pose',!!copy&&actions.poses[first.id].position[0]!==999&&actions.savedStanding.x===standing.x);actions.restorePose();
 check(id+' rejects a blocked/outside standing pose and unsupported fixture',actions.selectPose(first?.id,{x:999,z:999,yaw:0,pitch:0})===null&&actions.selectPose('unknown',standing)===null&&actions.states.pose.mode==='standing');
 check(id+' model hooks retain a real luminaire in every room',apartment.interactionVisuals?.lights?.length===data.rooms.length&&actions.visuals.lights.length===data.rooms.length&&actions.visuals.lights.every(l=>l.isPointLight&&!l.castShadow&&l.parent===actions.group));
 check(id+' actual room lights stay inside their room and below the ceiling',actions.visuals.lights.every(l=>insideRing(l.position.x,l.position.z,data.rooms[l.userData.room].p.map(p=>apartment.metrics.coord(...p)))&&insideRing(l.position.x,l.position.z,boundary)&&l.position.y>2.4&&l.position.y<data.ceilingHeight-.10));
 actions.setAction('apt-lights',true);
 check(id+' light switch changes real room light output and actual fixture emission',actions.states.lights.on&&actions.visuals.lights.every(l=>l.intensity>0)&&apartment.interactionVisuals.lights.every(v=>v.material.emissiveIntensity>0));
 actions.setAction('apt-lights',false);
 check(id+' light switch turns every fixture and room light off',!actions.states.lights.on&&actions.visuals.lights.every(l=>l.intensity===0)&&apartment.interactionVisuals.lights.every(v=>v.material.emissiveIntensity===0));
 const sourceTVCount=data.furniture.filter(f=>f[0]==='tv').length;
 check(id+' preserves an independently controlled actual screen for every television',televisions.length===sourceTVCount&&new Set(televisions.map(t=>t.material)).size===sourceTVCount&&new Set(televisions.map(t=>t.texture)).size===sourceTVCount&&televisions.every(t=>t.mesh.isMesh&&t.mesh.material===t.material&&t.material.map===t.texture&&t.material.emissiveMap===t.texture),{sourceTVCount,hookTVCount:televisions.length});
 apartment.root.updateMatrixWorld(true);const backwardTVs=televisions.filter(v=>{const f=actions.fixtureData[v.index],p=v.mesh.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).transformDirection(v.mesh.matrixWorld),front=p.addScaledVector(normal,.4);return f.room<0||!insideRing(front.x,front.z,data.rooms[f.room].p.map(p=>apartment.metrics.coord(...p)))||!insideRing(front.x,front.z,boundary);});
 check(id+' actual TV screen fronts face their room instead of the wall or exterior',backwardTVs.length===0,{backward:backwardTVs.map(v=>({index:v.index,source:data.furniture[v.index]}))});
 const excluded=new Set(televisions.map(t=>t.material)),appliances=new Map();apartment.root.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!excluded.has(material))appliances.set(material,snapshotMaterial(material));});
 if(televisions.length){
  const firstTV=televisions[0];actions.setAction(firstTV.id,true);
  check(id+' one TV switch changes its actual emission without turning other screens on',actions.states.televisions[firstTV.index].on&&firstTV.material.emissiveIntensity>.5&&televisions.slice(1).every(v=>!actions.states.televisions[v.index].on&&v.material.emissiveIntensity===0));
  for(const v of televisions)actions.setAction(v.id,true);
  const before=televisions.map(v=>Uint8Array.from(v.texture.image.data));for(let frame=0;frame<180;frame++)actions.update(frame/60);
  check(id+' live TV changes original illustrated pixel frames and keeps the embedded author signature',televisions.every((v,i)=>before[i].some((n,j)=>n!==v.texture.image.data[j])&&readPixelSignature(v.texture.image.data).startsWith('@r_peredelkino|RP-CONCEPT-2026-10-07')));
  const paused=televisions.map(v=>({time:actions.states.televisions[v.index].time,bytes:Uint8Array.from(v.texture.image.data)}));for(let frame=180;frame<220;frame++)actions.update(frame/60,{paused:true});
  check(id+' paused TV retains its exact frame and elapsed state',televisions.every((v,i)=>paused[i].time===actions.states.televisions[v.index].time&&paused[i].bytes.every((n,j)=>n===v.texture.image.data[j])));
  for(let frame=220;frame<260;frame++)actions.update(frame/60,{reducedMotion:true});
  check(id+' reduced-motion TV has no changing pixels or elapsed animation',televisions.every((v,i)=>paused[i].time===actions.states.televisions[v.index].time&&paused[i].bytes.every((n,j)=>n===v.texture.image.data[j])));
  for(const v of televisions)actions.setAction(v.id,false);
  check(id+' each TV turns off without replacing or sharing its material',televisions.every(v=>!actions.states.televisions[v.index].on&&v.material.emissiveIntensity===0&&v.mesh.material===v.material));
 }
 check(id+' TV actions never recolor appliances, laptop screens or other materials',[...appliances].every(([m,s])=>sameMaterial(m,s)));
 apartment.setFurniture(false);check(id+' hidden furniture rejects sitting/lying actions',actions.selectPose(first?.id,standing)===null);apartment.setFurniture(true);
 actions.update(5,{reducedMotion:true});const reduced=actions.selectPose(first?.id,standing);check(id+' reduced-motion resting view applies instantly',reduced?.transitionDuration===0);actions.restorePose();
 const owned=televisions.map(v=>v.texture),events=new Map();for(const t of owned)t.addEventListener('dispose',()=>events.set(t,(events.get(t)||0)+1));actions.setAction('apt-lights',true);for(const v of televisions)actions.setAction(v.id,true);actions.dispose();actions.dispose();
 check(id+' owned TV textures dispose exactly once and original maps/material state return',owned.every(t=>events.get(t)===1)&&televisions.every(v=>sameMaterial(v.material,originalMaps.get(v.index))));
 check(id+' disposal removes room lights, clears all activity and rejects further actions',actions.disposed&&actions.group.parent===null&&actions.group.children.length===0&&actions.visuals.lights.every(l=>l.parent===null)&&!actions.states.lights.on&&Object.values(actions.states.televisions).every(v=>!v.on)&&actions.setAction('apt-lights',true)===false&&actions.selectPose(first?.id,standing)===null&&actions.restorePose()===null);
 apartment.dispose();
}
check('Catalogue covers beds, both sofa shapes, chairs and toilets',Object.keys(coverage).length===5&&['bed','sofa','lsofa','chair','toilet'].every(t=>coverage[t]>0),{coverage});
check('Every catalogue apartment has at least one independently switched television',models.length>2&&models.every(m=>m.televisions>0),{withoutTV:models.filter(m=>m.televisions===0).map(m=>m.id)});
const report={revision:37,pass:checks.every(c=>c.pass),checkCount:checks.length,checks,models,coverage,timestamp:new Date().toISOString()};
const out=process.env.RP_QA_OUT||path.join(project,'tools/qa-v37');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'apartment-actions-cpu.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
