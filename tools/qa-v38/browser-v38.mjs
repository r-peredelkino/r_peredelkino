// Native Chrome integration proof. Run against the full installed asset tree.
// RP_QA_BASE_URL=http://127.0.0.1:8099/r_peredelkino RP_QA_OUT=/tmp/rodina-qa-v38
// Native ARM node: /tmp/rodina-v38-runtime/node-v24.4.0-darwin-arm64/bin/node
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.RP_PUPPETEER_PATH||'/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base=(process.env.RP_QA_BASE_URL||'http://127.0.0.1:8099/r_peredelkino').replace(/\/$/,''),out=process.env.RP_QA_OUT||'/tmp/rodina-qa-v38';
fs.mkdirSync(out,{recursive:true});
const errors=[],consoleErrors=[],shaderErrors=[],badResources=[],screens=[],checks=[],warnings=[];
const progress=(stage,details={})=>console.log(JSON.stringify({stage,...details}));
progress('browser-launch');
const browser=await puppeteer.launch({headless:true,executablePath:process.env.RP_CHROME_PATH||'/tmp/rodina-v38-chrome-arm64',userDataDir:path.join(out,'browser-v38-profile-'+Date.now()),args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync']});
progress('browser-launched');
const page=await browser.newPage();page.setDefaultTimeout(120000);// Keep touch capability constant when resizing: Puppeteer reloads the page
// when hasTouch changes, which would discard the tested scene and its APIs.
await page.setViewport({width:1500,height:1000,deviceScaleFactor:1,hasTouch:true});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{const value=message.text();if(message.type()==='error'){consoleErrors.push(value);if(/shader|WebGLProgram|GL_INVALID|VALIDATE_STATUS|program not valid/i.test(value))shaderErrors.push(value)}else if(message.type()==='warn')warnings.push(value)});
page.on('response',response=>{if(response.url().startsWith(base+'/')&&response.status()>=400)badResources.push({url:response.url(),status:response.status()})});
const check=(name,result)=>{const item={name,pass:!!result.pass,...result};checks.push(item);if(!item.pass)throw new Error(name+' '+JSON.stringify(result))};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function screen(name){const filename=name+'.png';await page.screenshot({path:path.join(out,filename)});screens.push(filename)}
let fatal=null;
try{
 progress('navigation',{base});
 await page.goto(base+'/index.html?view=genplan',{waitUntil:'load'});
 progress('page-loaded',await page.evaluate(()=>({mapView:document.body.dataset.mapView,hasMount:typeof window.mountClusterMap==='function',hostPresent:!!document.querySelector('#cluster-map'),hasModel:!!document.querySelector('#cluster-map')?.communityModel,hasTour:!!document.querySelector('#cluster-map')?.tourAPI})));
 await page.evaluate(async()=>{
  const T=await import('./vendor/three.module.js'),before=T.Scene.prototype.onBeforeRender;
  T.Scene.prototype.onBeforeRender=function(renderer,scene,camera,...rest){before?.call(this,renderer,scene,camera,...rest);if(renderer.domElement.closest('#cluster-map'))window.__v38Live={renderer,scene,camera};};
  const h=document.querySelector('#cluster-map');if(!h?.communityModel||!h?.tourAPI)window.setMapView?.('district');
 });
 progress('mount-requested');
 await page.waitForFunction(()=>document.querySelector('#cluster-map')?.communityModel&&document.querySelector('#cluster-map')?.tourAPI&&document.querySelector('#cluster-map')?.solarEnvironment);
 progress('model-ready');
 await page.evaluate(()=>{
  const host=document.querySelector('#cluster-map');host.solarEnvironment.setDate('2026-07-15',780);host.solarEnvironment.setQuality('full');host.communityModel.life.setEnabled(true);
  window.__v38Protected=()=>{
   const m=document.querySelector('#cluster-map').communityModel;
   const hash=buffer=>{const bytes=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);let value=2166136261;for(const byte of bytes)value=Math.imul(value^byte,16777619);return(value>>>0).toString(16)};
   return JSON.stringify(Array.from(m.towers.values()).map(t=>({id:t.spec.id,x:t.spec.x,z:t.spec.z,angle:t.spec.angle,h:t.spec.h,floors:t.spec.floors,facade:hash(t.facade.geometry.attributes.position.array),windows:hash(t.windows.instanceMatrix.array),windowVertices:hash(t.windows.geometry.attributes.position.array),panels:hash(t.panels.instanceMatrix.array)})));
  };
  window.__v38ProtectedBefore=window.__v38Protected();
 });
 await page.waitForFunction(()=>window.__v38Live?.renderer.info.render.triangles>0);
 check('Public masterplan uses a real WebGL2 renderer and current geometry',await page.evaluate(()=>({pass:document.body.dataset.experience==='genplan'&&window.__v38Live.renderer.getContext().getParameter(window.__v38Live.renderer.getContext().VERSION).includes('WebGL 2.0')&&window.__v38Live.renderer.info.render.triangles>10000,release:document.documentElement.dataset.release,publication:document.documentElement.dataset.publication,render:{...window.__v38Live.renderer.info.render}})));
 check('Visitors and residents use the same bound navigation world',await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),m=h.communityModel;return{pass:!!m.pedestrianNavigation&&h.tourAPI.world===m.pedestrianNavigation.world&&m.life.stats.navigationRevision>=1,stats:m.life.stats,navigation:m.pedestrianNavigation.stats}}));
 await page.evaluate(()=>window.clusterCamera('reset'));await wait(500);await screen('v38-genplan-overview');
 const roles=await page.evaluate(()=>Object.keys(document.querySelector('#cluster-map').communityModel.life.stats.roles));
 check('All seven neighbour activities are instantiated and active',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').communityModel.life.stats;return{pass:Object.keys(s.roles).length===7&&Object.values(s.roles).every(r=>r.total>0&&r.active===r.total)&&s.actors===52&&s.actorDrawBatches<=45,stats:s}}));
 const initialActors=await page.evaluate(()=>document.querySelector('#cluster-map').communityModel.life.actors.map(a=>({id:a.g.userData.actorId,role:a.role,position:[a.g.position.x,a.g.position.y,a.g.position.z],distance:a.distance,wheel:a.bike?.wheels?.[0]?.rotation.x??null,limb:a.person?.ll?.rotation.x??a.person?.g?.children?.length??null})));
 await wait(1000);
 check('Walking, running, cycling, deliveries and robots move along safe routes',await page.evaluate(before=>{const m=document.querySelector('#cluster-map').communityModel,failures=[];for(const role of ['walker','runner','dogwalker','cyclist','courier','robot']){const active=m.life.actors.filter(a=>a.role===role&&a.active),moved=active.some(a=>{const b=before.find(v=>v.id===a.g.userData.actorId);return Math.hypot(a.g.position.x-b.position[0],a.g.position.z-b.position[2])>.05});if(!moved||active.some(a=>!a.world.free(a.g.position.x,a.g.position.z)))failures.push(role)}return{pass:failures.length===0,failures,stats:m.life.stats};},initialActors));
 check('Companion dogs follow actual paved routes and cyclists animate real wheels',await page.evaluate(before=>{const m=document.querySelector('#cluster-map').communityModel,dogs=m.life.actors.filter(a=>a.role==='dogwalker'),cycles=m.life.actors.filter(a=>a.role==='cyclist'||a.role==='courier');return{pass:dogs.length===6&&dogs.every(a=>a.dog?.worldPosition&&a.world.free(a.dog.worldPosition.x,a.dog.worldPosition.z)&&a.dog.leash.geometry)&&cycles.length===10&&cycles.every(a=>a.bike?.wheels?.length===2&&Math.abs(a.bike.wheels[0].rotation.x-before.find(b=>b.id===a.g.userData.actorId).wheel)>.03),dogs:dogs.map(a=>({id:a.g.userData.actorId,position:a.dog?.worldPosition?.toArray()})),cycles:cycles.map(a=>({id:a.g.userData.actorId,wheel:a.bike?.wheels?.[0]?.rotation.x}))}},initialActors));


 await page.click('#cluster-life');
 const pausedActors=await page.evaluate(()=>{const m=document.querySelector('#cluster-map').communityModel;return{time:m.life.time,positions:m.life.actors.map(a=>a.g.position.toArray()),enabled:m.life.enabled}});
 await wait(500);
 check('The visible life control freezes actor motion and its simulation clock',await page.evaluate(before=>{const m=document.querySelector('#cluster-map').communityModel;return{pass:!m.life.enabled&&m.life.time===before.time&&JSON.stringify(m.life.actors.map(a=>a.g.position.toArray()))===JSON.stringify(before.positions)&&!m.traffic.enabled,time:m.life.time,trafficEnabled:m.traffic.enabled}},pausedActors));
 await page.click('#cluster-life');await wait(300);
 check('Resuming neighbourhood life restarts people and traffic',await page.evaluate(before=>{const m=document.querySelector('#cluster-map').communityModel;return{pass:m.life.enabled&&m.life.time>before.time&&m.traffic.enabled,time:m.life.time,trafficEnabled:m.traffic.enabled}},pausedActors));

 // Macro views draw the exact current scene and its real objects; there is no
 // substitute demonstration model. Reuse the public GPU context: its PMREM
 // environment and shadow targets cannot be transferred to a second renderer.
 // The public animation loop is paused only for each image, then restored.
 async function closeup(role,name,carStyle=null){
  const result=await page.evaluate(async({role,carStyle})=>{
   const T=await import('./vendor/three.module.js'),live=window.__v38Live,m=document.querySelector('#cluster-map').communityModel;
   let p,yaw,label;
   if(carStyle){const car=m.traffic.cars.find(c=>c.active&&c.vehicleStyle===carStyle);if(!car)throw new Error('No active real vehicle for style '+carStyle);p=car.world.clone();yaw=car.heading;label='vehicle '+car.vehicleStyle+' '+car.index;}
   else{const actor=m.life.actors.find(a=>a.role===role&&a.active);p=actor.g.position.clone();yaw=actor.g.rotation.y;label=actor.g.userData.actorId;}
   const camera=new T.PerspectiveCamera(48,1.5,.025,1000),target=p.clone().add(new T.Vector3(0,carStyle?.75:role==='robot'?.45:role==='seated'?1.05:.95,0));
   const distance=carStyle?8.0:role==='cyclist'||role==='courier'?5:4.0,c=Math.cos(yaw),s=Math.sin(yaw);camera.position.set(p.x+s*distance+c*distance*.48,p.y+(carStyle?2.7:role==='robot'?1.35:1.7),p.z+c*distance-s*distance*.48);camera.lookAt(target);camera.updateMatrixWorld();
   const renderer=live.renderer,canvas=renderer.domElement,host=document.querySelector('#cluster-map'),rig=host.solarEnvironment.daylightRig;
   const saved={size:renderer.getSize(new T.Vector2()),style:canvas.style.cssText,camera:live.camera,target:renderer.getRenderTarget(),showroomOpen:document.body.classList.contains('showroom-open')};
   document.body.classList.add('showroom-open');
   renderer.setSize(1500,1000,false);renderer.setRenderTarget(null);
   Object.assign(canvas.style,{position:'fixed',inset:'0',width:'1500px',height:'1000px',maxWidth:'none',maxHeight:'none',zIndex:'2147483646',pointerEvents:'none'});
   window.__v38ProofCleanup=()=>{
    canvas.style.cssText=saved.style;renderer.setSize(saved.size.x,saved.size.y,false);renderer.setRenderTarget(saved.target);rig.focus(saved.camera);renderer.render(live.scene,saved.camera);
    if(!saved.showroomOpen)document.body.classList.remove('showroom-open');
   };
   rig.focus(camera);renderer.render(live.scene,camera);
   return{label,point:p.toArray(),render:{...renderer.info.render},glError:renderer.getContext().getError(),programs:renderer.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable!==false}))};
  },{role,carStyle});
  try{
   check('Actual rendered close-up '+name,{pass:result.glError===0&&result.render.triangles>1000&&result.programs.every(p=>p.runnable),...result});
   await screen(name);progress('closeup',{name});
  }finally{await page.evaluate(()=>{window.__v38ProofCleanup?.();delete window.__v38ProofCleanup;});}
 }
 await page.evaluate(()=>document.querySelector('#cluster-map').solarEnvironment.setQuality('full'));
 for(const role of roles)await closeup(role,'v38-'+role+'-closeup');
 await closeup(null,'v38-vehicle-closeup','sedan');
 await closeup(null,'v38-vehicle-suv-closeup','suv');
 await closeup(null,'v38-vehicle-compact-closeup','compact');
 await closeup(null,'v38-vehicle-van-closeup','van');
 progress('closeups-complete');

 progress('quality-checks');
 // Quality changes are driven through the visible select and assessed through
 // the submitted instances and the same renderer used by public visitors.
 await page.evaluate(()=>document.querySelector('#cluster-map').solarEnvironment.panel.open=true);
 const qualityStates=[];
 for(const choice of ['fast','balanced','full','max']){
  await page.select('#cluster-map + .env-panel [data-quality]',choice).catch(()=>page.select('.cluster-stage .env-panel [data-quality]',choice));
  await wait(300);
  const state=await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),m=h.communityModel;return{choice:h.solarEnvironment.getQuality(),life:m.life.stats,traffic:m.traffic.getStats(),actualRenderer:{...window.__v38Live.renderer.info.render},stored:localStorage.getItem('rp.render-quality.v38'),selected:h.solarEnvironment.panel.querySelector('[data-quality]').value}});
  qualityStates.push(state);
  check('Visible quality control applies '+choice,{pass:state.choice.choice===choice&&state.choice.effective===choice&&state.selected===choice&&state.stored===choice&&state.life.quality.id===choice,quality:state});
 }
 const fast=qualityStates[0],full=qualityStates[2];
 check('Economy mode submits fewer neighbours and vehicle detail triangles',{pass:Object.values(fast.life.roles).reduce((n,r)=>n+r.visible,0)<Object.values(full.life.roles).reduce((n,r)=>n+r.visible,0)&&fast.traffic.triangles<full.traffic.triangles&&fast.choice.pixelRatio<full.choice.pixelRatio,fast,full});
 check('Quality profiles retain all seven activities and unchanged traffic density',{pass:qualityStates.every(s=>Object.values(s.life.roles).every(r=>r.visible>0)&&s.traffic.activeCars===qualityStates[0].traffic.activeCars&&s.traffic.simulationDensityUnchanged),qualityStates});
 await page.select('.cluster-stage .env-panel [data-quality]','auto');
 check('Automatic quality can be selected again',await page.evaluate(()=>({pass:document.querySelector('#cluster-map').solarEnvironment.getQuality().choice==='auto'&&localStorage.getItem('rp.render-quality.v38')==='auto',state:document.querySelector('#cluster-map').solarEnvironment.getQuality()})));
 await screen('v38-quality-settings');
 await page.evaluate(()=>document.querySelector('#cluster-map').solarEnvironment.setQuality('balanced'));

 progress('walking-checks');
 const destinations=await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),t=h.tourAPI,results=[];t.enter();for(let i=0;i<t.destinations.length;i++){const ok=t.teleport(i),p=t.position;results.push({name:t.destinations[i].name,ok,free:t.activeWorld.free(p.x,p.z),elevation:t.elevation})}t.exit();return results});
 check('All exterior, bridge and terrace destinations retain safe walking entries',{pass:destinations.length>=12&&destinations.every(d=>d.ok&&d.free&&Number.isFinite(d.elevation)),destinations});
 await page.evaluate(()=>{const t=document.querySelector('#cluster-map').tourAPI;t.enter(t.destinations.findIndex(d=>d.name==='Проход 1–2'));});
 const passageBefore=await page.evaluate(()=>document.querySelector('#cluster-map').tourAPI.position);
 await page.keyboard.down('KeyW');await wait(2500);await page.keyboard.up('KeyW');
 check('Keyboard walking enters the K1–K2 passage without crossing walls',await page.evaluate(before=>{const t=document.querySelector('#cluster-map').tourAPI,p=t.position;return{pass:t.enabled&&t.activeWorld.free(p.x,p.z)&&Math.hypot(p.x-before.x,p.z-before.z)>.5,position:p,start:before,elevation:t.elevation}},passageBefore));
 await screen('v38-passage-walk');
 await page.evaluate(()=>{const t=document.querySelector('#cluster-map').tourAPI;t.teleport(t.destinations.findIndex(d=>d.name==='Променад'));});await wait(250);await screen('v38-promenade-walk');
 const seatResult=await page.evaluate(()=>{const t=document.querySelector('#cluster-map').tourAPI,item=t.interactions.find(i=>i.type==='seat'&&i.id.startsWith('cyber-seat'));return{ok:t.goToInteraction(item.id),id:item.id,worldFree:t.activeWorld.free(t.position.x,t.position.z)}});
 check('A real courtyard bench has an accessible approach',{pass:seatResult.ok&&seatResult.worldFree,...seatResult});
 await page.keyboard.press('KeyE');
 check('The real action key seats the visitor on the existing bench',await page.evaluate(id=>({pass:document.querySelector('#cluster-map').tourAPI.seated===id,seated:document.querySelector('#cluster-map').tourAPI.seated}),seatResult.id));await screen('v38-bench-seated');
 await page.keyboard.press('KeyE');
 check('Standing restores a safe paved position',await page.evaluate(()=>{const t=document.querySelector('#cluster-map').tourAPI,p=t.position;return{pass:t.seated===null&&t.activeWorld.free(p.x,p.z),position:p}}));
 const lounge=await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),m=h.communityModel,ids=new Set((m.quietLounge?.interactions??[]).map(i=>i.id));return m.quietLounge?{present:true,metadata:m.quietLounge.metadata,ids:h.tourAPI.interactions.filter(i=>ids.has(i.id)).map(i=>({id:i.id,type:i.type,free:h.tourAPI.world.free(...i.point)}))}:{present:false}});
 check('New outdoor lounge is installed with three safe seats and a compact geometry budget',{pass:lounge.present&&!lounge.metadata.skipped&&lounge.metadata.seatCount===3&&lounge.metadata.drawCalls<=7&&lounge.metadata.triangles<=20000&&lounge.ids.length===3&&lounge.ids.every(i=>i.free),lounge});
 const loungeSeat=await page.evaluate(id=>{const t=document.querySelector('#cluster-map').tourAPI;return{ok:t.goToInteraction(id),id,free:t.activeWorld.free(t.position.x,t.position.z)}},lounge.ids[0].id);
 check('The new lounge can be reached through the real walking interaction',{pass:loungeSeat.ok&&loungeSeat.free,...loungeSeat});
 await page.keyboard.press('KeyE');
 check('The action key seats a guest on the new outdoor lounge bench',await page.evaluate(id=>({pass:document.querySelector('#cluster-map').tourAPI.seated===id,seated:document.querySelector('#cluster-map').tourAPI.seated}),loungeSeat.id));
 await screen('v38-quiet-lounge-seated');await page.keyboard.press('KeyE');
 await page.evaluate(id=>{const h=document.querySelector('#cluster-map');h.solarEnvironment.setQuality('full');h.tourAPI.goToInteraction(id);},loungeSeat.id);
 await page.click('#cluster-map [data-cyber-visible]');
 await page.waitForFunction(()=>document.querySelector('#cluster-map').communityModel.life.stats.roles.seated.visible===0);
 check('Hiding authored benches also hides all six seated neighbours',await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),m=h.communityModel,s=m.life.stats;return{pass:!m.cyberCourtyard.visible&&!m.quietLounge.visible&&s.roles.seated.visible===0&&s.roles.seated.total===6&&h.querySelector('[data-cyber-visible]').getAttribute('aria-pressed')==='false',seated:s.roles.seated,seatingVisible:s.seatingVisible}}));
 const hiddenBenchStart=await page.evaluate(()=>document.querySelector('#cluster-map').tourAPI.position);
 await page.keyboard.down('KeyS');await wait(500);await page.keyboard.up('KeyS');
 const hiddenBenchPosition=await page.evaluate(before=>{
  const h=document.querySelector('#cluster-map'),m=h.communityModel,t=h.tourAPI,p=t.position,o=m.quietLounge.colliders.find(o=>o.type==='box'&&o.width>3);
  const c=Math.cos(o.angle||0),s=Math.sin(o.angle||0),dx=p.x-o.x,dz=p.z-o.z,u=c*dx-s*dz,v=s*dx+c*dz;
  const clearance=Math.hypot(Math.max(Math.abs(u)-o.width/2,0),Math.max(Math.abs(v)-o.depth/2,0));
  return{pass:o.enabled===false&&t.activeWorld.free(p.x,p.z)&&Math.hypot(p.x-before.x,p.z-before.z)>.2&&clearance<t.activeWorld.radius,position:p,start:before,bench:{x:o.x,z:o.z,width:o.width,depth:o.depth,enabled:o.enabled},clearance,radius:t.activeWorld.radius,bodyOverlapsActualBench:clearance<t.activeWorld.radius};
 },hiddenBenchStart);
 check('Real keyboard movement can enter the disabled bench collision footprint',hiddenBenchPosition);
 await page.click('#cluster-map [data-cyber-visible]');
 await page.waitForFunction(()=>document.querySelector('#cluster-map').communityModel.life.stats.roles.seated.visible===6);
 check('Restoring benches safely moves the visitor clear and restores seated neighbours',await page.evaluate(before=>{const h=document.querySelector('#cluster-map'),m=h.communityModel,t=h.tourAPI,p=t.position;return{pass:m.cyberCourtyard.visible&&m.quietLounge.visible&&t.activeWorld.free(p.x,p.z)&&Math.hypot(p.x-before.x,p.z-before.z)>.1&&m.life.stats.roles.seated.visible===6&&h.querySelector('[data-cyber-visible]').getAttribute('aria-pressed')==='true',position:p,before,seated:m.life.stats.roles.seated}},hiddenBenchPosition.position));
 await page.evaluate(()=>document.querySelector('#cluster-map').solarEnvironment.setQuality('balanced'));
 await page.evaluate(()=>window.clusterCamera('courtyard'));await wait(300);await screen('v38-courtyard-decor');

 progress('audio-checks');
 // Audio must start from a real user action. Opening a dialog suspends the
 // browser AudioContext rather than leaving a muted scheduling loop running.
 check('Forest ambience never starts before a visitor gesture',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState();return{pass:!s.enabled&&s.contextState==='uncreated'&&s.supported,state:s}}));
 await page.evaluate(()=>{const h=document.querySelector('#cluster-map');h.tourAPI.enter(h.tourAPI.destinations.findIndex(d=>d.name==='Лес'));h.solarEnvironment.panel.open=true;h.solarEnvironment.forestSound.update();});
 await page.click('#cluster-map [data-tour-sound]');
 await page.waitForFunction(()=>document.querySelector('#cluster-map').solarEnvironment.forestSound.getState().contextState==='running'&&document.querySelector('#cluster-map [data-tour-sound]').getAttribute('aria-pressed')==='true');
 check('A visitor click enables actual forest audio near the trees',await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),s=h.solarEnvironment.forestSound.getState();return{pass:s.enabled&&!s.blocked&&s.proximity>.05&&s.contextState==='running'&&h.querySelector('[data-tour-sound]').getAttribute('aria-pressed')==='true',state:s}}));
 await screen('v38-forest-walk-sound');
 // The settings panel is deliberately hidden during first-person walking.
 // Leave the tour before operating its visible range control with real keys.
 await page.evaluate(()=>{const h=document.querySelector('#cluster-map');h.tourAPI.exit();h.solarEnvironment.panel.open=true;const slider=h.solarEnvironment.panel.querySelector('[data-forest-volume]');for(let p=slider.parentElement;p&&p!==document.body;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;slider.scrollIntoView({block:'center'});});
 await page.focus('.cluster-stage .env-panel [data-forest-volume]');await page.keyboard.press('End');for(let i=0;i<38;i++)await page.keyboard.press('ArrowLeft');
 check('The volume slider changes real sound state and persists its value',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState(),saved=JSON.parse(localStorage.getItem('rp.forest-sound.v38'));return{pass:s.volume===.62&&saved.volume===.62&&saved.enabled,state:s,saved}}));
 await page.evaluate(()=>{const h=document.querySelector('#cluster-map');h.tourAPI.enter(h.tourAPI.destinations.findIndex(d=>d.name==='Лес'));h.solarEnvironment.forestSound.update();});
 await page.evaluate(()=>{const dialog=document.createElement('dialog');dialog.id='v38-audio-modal-proof';dialog.textContent='Проверка паузы звука';document.body.append(dialog);dialog.showModal();});
 await page.waitForFunction(()=>document.querySelector('#cluster-map').solarEnvironment.forestSound.getState().contextState==='suspended');
 check('An open modal suspends forest audio and clears bird nodes',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState();return{pass:s.enabled&&s.blocked&&s.contextState==='suspended'&&s.transientNodes===0,state:s}}));
 await page.evaluate(()=>{const d=document.querySelector('#v38-audio-modal-proof');d.close();d.remove();});
 await page.waitForFunction(()=>document.querySelector('#cluster-map').solarEnvironment.forestSound.getState().contextState==='running');
 check('Closing the modal resumes the enabled ambience',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState();return{pass:s.enabled&&!s.blocked&&s.contextState==='running',state:s}}));
 const forestNear=await page.evaluate(()=>document.querySelector('#cluster-map').solarEnvironment.forestSound.getState().proximity);
 await page.evaluate(()=>window.clusterCamera('top'));await wait(350);
 check('Forest sound fades out in the high aerial view',await page.evaluate(near=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState();return{pass:s.proximity<near&&s.proximity<.01,state:s,near}},forestNear));
 await page.evaluate(()=>{const h=document.querySelector('#cluster-map');h.tourAPI.enter(h.tourAPI.destinations.findIndex(d=>d.name==='Лес'));});
 await page.click('#cluster-map [data-tour-sound]');
 await page.waitForFunction(()=>document.querySelector('#cluster-map').solarEnvironment.forestSound.getState().contextState==='suspended'&&document.querySelector('#cluster-map [data-tour-sound]').getAttribute('aria-pressed')==='false');
 check('Turning ambience off suspends the AudioContext and persists off',await page.evaluate(()=>{const s=document.querySelector('#cluster-map').solarEnvironment.forestSound.getState(),saved=JSON.parse(localStorage.getItem('rp.forest-sound.v38'));return{pass:!s.enabled&&s.contextState==='suspended'&&!saved.enabled,state:s,saved}}));
 await page.evaluate(()=>document.querySelector('#cluster-map').tourAPI.exit());
 check('Quality, movement and camera changes preserve tower and pane geometry',await page.evaluate(()=>({pass:window.__v38ProtectedBefore===window.__v38Protected(),fingerprint:window.__v38Protected()})));
 check('All compiled live scene shader programs are runnable',await page.evaluate(()=>{const r=window.__v38Live.renderer;return{pass:r.getContext().getError()===0&&r.info.programs.length>0&&r.info.programs.every(p=>p.diagnostics?.runnable!==false),programs:r.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable!==false})),render:{...r.info.render}}}));
 progress('mobile-checks');
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,hasTouch:true});await wait(350);
 await page.evaluate(()=>{document.querySelector('#cluster-map').solarEnvironment.panel.open=false;window.clusterCamera('walk');});await wait(300);
 check('Mobile walking sticks and exit remain inside the viewport',await page.evaluate(()=>{const h=document.querySelector('#cluster-map'),selectors=['.tour-joystick','.tour-look-stick','.tour-exit'],rects=selectors.map(s=>{const e=h.querySelector(s),r=e.getBoundingClientRect();return{selector:s,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}});return{pass:h.tourAPI.enabled&&rects.every(r=>r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1),rects,viewport:[innerWidth,innerHeight]}}));
 await screen('v38-mobile-walk');
 check('Integration completes without runtime, console, shader or asset errors',{pass:errors.length===0&&consoleErrors.length===0&&shaderErrors.length===0&&badResources.length===0,errors,consoleErrors,shaderErrors,badResources});
 check('Visual acceptance captured all activities and public controls',{pass:screens.length>=20&&checks.length>=40,screens:screens.length,checks:checks.length});
}catch(error){fatal=error.stack||String(error);try{await screen('v38-failure')}catch{}}
finally{
 const result={revision:38,base,pass:!fatal&&checks.every(c=>c.pass),checkCount:checks.length,screens,checks,errors,consoleErrors,shaderErrors,badResources,warnings,fatal};
 fs.writeFileSync(path.join(out,'browser-v38.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({revision:38,pass:result.pass,checkCount:result.checkCount,screens:screens.length,failed:checks.filter(c=>!c.pass),fatal,errors,consoleErrors,shaderErrors,badResources},null,2));
 await browser.close();if(!result.pass)process.exitCode=1;
}
