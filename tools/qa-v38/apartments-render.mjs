// Actual apartment factories rendered in an isolated WebGL2 scene at the same
// project URL. This checks GPU models and actions; it does not claim UI coverage.
// Set RP_QA_CHROME, RP_PUPPETEER_PATH, RP_QA_BASE_URL and RP_QA_OUT on the runner.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.RP_PUPPETEER_PATH||'puppeteer');
const chrome=process.env.RP_QA_CHROME||process.env.RP_CHROME_PATH;
if(!chrome)throw new Error('Set RP_QA_CHROME to the installed Chrome executable.');
const base=(process.env.RP_QA_BASE_URL||process.env.RP_QA_URL||'http://127.0.0.1:8099/r_peredelkino').replace(/\/$/,''),out=process.env.RP_QA_OUT||'/tmp/rodina-qa-v38';
const cache=process.env.RP_QA_CACHE||'community38',checks=[],errors=[],shaderErrors=[],badResources=[],screens=[],plans=[];
await fs.mkdir(out,{recursive:true});const profile=await fs.mkdtemp(path.join(out,'apartments-render-profile-'));
const report={revision:38,base,scope:'isolated actual apartment factory GPU proof; separate from public UI acceptance',expectedApartments:17,minimumChecks:70,checks,errors,shaderErrors,badResources,screens,plans,pass:false,nodeArchitecture:process.arch};
const add=(name,result)=>checks.push({name,...result,pass:!!result.pass});
let browser,page,fatal=null,currentPlan=null;
const selectedScreens=new Set(['1-81','2-588','4-1071']);
async function screenshot(id,mode){const file='apartment-'+id+'-'+mode+'.png';await page.screenshot({path:path.join(out,file)});screens.push({id,mode,file});}
try{
 browser=await puppeteer.launch({headless:true,executablePath:chrome,userDataDir:profile,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync']});
 report.chromeVersion=await browser.version();page=await browser.newPage();page.setDefaultTimeout(120000);
 await page.setViewport({width:800,height:600,deviceScaleFactor:1});await page.setCacheEnabled(false);
 page.on('pageerror',error=>errors.push({plan:currentPlan,message:error.message}));
 page.on('console',message=>{if(message.type()==='error'&&/shader|WebGLProgram|GL_INVALID|VALIDATE_STATUS|LINK_STATUS|program not valid/i.test(message.text()))shaderErrors.push({plan:currentPlan,message:message.text()});});
 page.on('response',response=>{if(response.url().startsWith(base+'/')&&response.status()>=400)badResources.push({plan:currentPlan,url:response.url(),status:response.status()});});
 await page.setRequestInterception(true);const entry=base+'/qa-apartments.html';
 page.on('request',request=>request.url()===entry?request.respond({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><title>Actual apartment GPU acceptance</title><link rel="icon" href="data:,"><style>html,body{margin:0;width:800px;height:600px;overflow:hidden;background:#cad8dc}canvas{display:block;width:800px;height:600px}</style></head><body></body></html>'}):request.continue());
 await page.goto(entry,{waitUntil:'load'});
 const setup=await page.evaluate(async cache=>{
  const T=await import('./vendor/three.module.js'),{apartmentPlans}=await import('./apartment-plans.js?v='+cache),{createApartment}=await import('./apartment-model.js?v='+cache),{createApartmentActions}=await import('./apartment-actions-v37.js?v='+cache),{readPaneProvenance}=await import('./surface-provenance-v38.js?v='+cache);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,600);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.setClearColor(0xcad8dc,1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const shaderFailures=[];renderer.debug.onShaderError=(gl,program,vertex,fragment)=>shaderFailures.push({program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});
  document.body.append(renderer.domElement);
  const scene=new T.Scene(),hemisphere=new T.HemisphereLight(0xe8f5ff,0xa6aa91,1.5),sun=new T.DirectionalLight(0xfff0d7,2.3);
  sun.position.set(-9,18,12);sun.castShadow=true;sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.5,far:65});sun.shadow.bias=-.00012;sun.shadow.normalBias=.02;scene.add(hemisphere,sun,sun.target);
  const overhead=new T.PerspectiveCamera(42,4/3,.025,200),walking=new T.PerspectiveCamera(70,4/3,.025,200);
  // An empty scene does not initialize all r186 light-owned shadow resources.
  // Submit a genuine lit caster and receiver first, then dispose its geometry
  // and material. r186 initializes its shared DFG lighting lookup texture for
  // physically based materials. A lit shadow receiver also exercises shadow
  // sampling; an unlit Basic material cannot warm those Standard shader paths.
  // The retained shadow target and shader belong to this renderer,
  // rather than to any of the seventeen apartment models tested afterwards.
  const warmGeometry=new T.BoxGeometry(.5,.5,.5),warmMaterial=new T.MeshStandardMaterial({color:0xc3c9bb,roughness:.8,side:T.DoubleSide});warmMaterial.shadowSide=T.DoubleSide;
  const warmCaster=new T.Mesh(warmGeometry,warmMaterial);warmCaster.position.y=.25;warmCaster.castShadow=true;warmCaster.receiveShadow=true;scene.add(warmCaster);
  overhead.position.set(3,4,5);overhead.lookAt(0,.25,0);overhead.updateMatrixWorld(true);renderer.render(scene,overhead);
  const warmup={render:{...renderer.info.render},glError:renderer.getContext().getError(),shaderFailures:shaderFailures.length,materialType:warmMaterial.type,castsShadow:warmCaster.castShadow,receivesShadow:warmCaster.receiveShadow};
  warmCaster.removeFromParent();warmGeometry.dispose();warmMaterial.dispose();renderer.renderLists.dispose();renderer.render(scene,overhead);
  const sharedRendererPrograms=new Set(renderer.info.programs),shadowTargets=()=>({color:sun.shadow.map?.texture?.uuid??null,depth:sun.shadow.map?.depthTexture?.uuid??null});
  const baseline={geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,programIdentities:renderer.info.programs.map(program=>({id:program.id,name:program.name})),shadowTargets:shadowTargets()};
  window.__apartmentsGPU={T,apartmentPlans,createApartment,createApartmentActions,readPaneProvenance,renderer,scene,overhead,walking,baseline,warmup,sharedRendererPrograms,shadowTargets,shaderFailures,apartment:null,actions:null};
  const gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
  return {ids:Object.keys(apartmentPlans),threeRevision:Number(T.REVISION),context:gl.getParameter(gl.VERSION),gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),baseline,warmup,drawingBuffer:[renderer.domElement.width,renderer.domElement.height],glError:gl.getError()};
 },cache);
 report.renderer=setup;
 add('Isolated renderer uses the actual current Three.js module, WebGL2 and an 800 by 600 drawing buffer',{pass:setup.threeRevision===186&&setup.context.includes('WebGL 2.0')&&setup.glError===0&&setup.warmup.glError===0&&setup.warmup.render.triangles>0&&setup.warmup.shaderFailures===0&&setup.warmup.materialType==='MeshStandardMaterial'&&setup.warmup.castsShadow&&setup.warmup.receivesShadow&&JSON.stringify(setup.drawingBuffer)==='[800,600]',...setup});
 add('The actual source catalogue contains every one of the seventeen published 3D apartments',{pass:setup.ids.length===17&&['1-81','2-588','4-1071'].every(id=>setup.ids.includes(id)),ids:setup.ids});
 for(const id of setup.ids){
  currentPlan=id;console.log(JSON.stringify({stage:'apartment-render',id}));
  const initial=await page.evaluate(id=>{
   const q=window.__apartmentsGPU,{T,renderer,scene}=q,apartment=q.createApartment(id);q.apartment=apartment;scene.add(apartment.root);
   const resources=new Set(),slots=['map','normalMap','bumpMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap'];
   const collect=()=>apartment.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const material of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){resources.add(material);for(const slot of slots)if(material[slot])resources.add(material[slot]);}});
   collect();const actions=q.createApartmentActions({apartment});q.actions=actions;collect();
   q.disposes=new Map();for(const resource of resources){q.disposes.set(resource,0);resource.addEventListener('dispose',()=>q.disposes.set(resource,q.disposes.get(resource)+1));}
   q.sourceBuffers=new Map();apartment.root.traverse(o=>{if(!o.geometry||q.sourceBuffers.has(o.geometry))return;const attributes={};for(const key of ['position','normal','uv'])if(o.geometry.attributes[key])attributes[key]=o.geometry.attributes[key].array.slice();q.sourceBuffers.set(o.geometry,attributes);});
   const bounds=new T.Box3().setFromObject(apartment.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.z,5);
   q.overhead.position.set(center.x,span*1.07+3,center.z+span*.65);q.overhead.lookAt(center.x,.35,center.z);q.overhead.updateMatrixWorld(true);
   const roomIndex=Math.max(0,apartment.data.rooms.findIndex(room=>/Гостиная|Кухня/.test(room.name))),spawn=apartment.world.roomPoint(roomIndex)||apartment.world.start;
   if(!spawn||!apartment.world.free(spawn.x,spawn.z))throw new Error('No safe source room camera for '+id);
   const pane=apartment.facadeRegistration.windows.flatMap(w=>w.panes).sort((a,b)=>Math.hypot(a.points[4][0]-spawn.x,a.points[4][1]-spawn.z)-Math.hypot(b.points[4][0]-spawn.x,b.points[4][1]-spawn.z))[0];
   const target=pane?.points[4]??[spawn.x,spawn.z-1];q.walking.position.set(spawn.x,Math.min(1.65,apartment.data.ceilingHeight-.2),spawn.z);q.walking.lookAt(target[0],1.5,target[1]);q.walking.updateMatrixWorld(true);
   q.stage=(name,camera)=>{
    renderer.compile(scene,camera);renderer.render(scene,camera);const gl=renderer.getContext(),sample=new Uint8Array(64*64*4);gl.readPixels(368,268,64,64,gl.RGBA,gl.UNSIGNED_BYTE,sample);
    let checksum=2166136261,minimum=255,maximum=0;for(let i=0;i<sample.length;i++){checksum=Math.imul(checksum^sample[i],16777619);if(i%4!==3){minimum=Math.min(minimum,sample[i]);maximum=Math.max(maximum,sample[i]);}}
    return {name,render:{...renderer.info.render},glError:gl.getError(),pixelChecksum:(checksum>>>0).toString(16),pixelRange:[minimum,maximum],programs:renderer.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable!==false})),shaderFailures:q.shaderFailures.length,memory:{...renderer.info.memory}};
   };
   apartment.setWalking(false);apartment.setFull(false);apartment.setFurniture(true);actions.setAction('lights',false);const low=q.stage('low-walls-furnished',q.overhead);
   q.planStages=[low];return {id,area:apartment.data.area,building:apartment.metrics.placement.building,floor:apartment.metrics.placement.floor,source:apartment.data.source??null,spawn:{x:spawn.x,z:spawn.z,room:roomIndex,free:apartment.world.free(spawn.x,spawn.z)},low,panes:apartment.facadeRegistration.windows.flatMap(w=>w.panes).length};
  },id);
  if(selectedScreens.has(id))await screenshot(id,'overview');
  const variants=await page.evaluate(()=>{
   const q=window.__apartmentsGPU,a=q.apartment,actions=q.actions;
   a.setWalking(true);a.setFurniture(true);const walkingOff=q.stage('walking-light-off',q.walking);
   const lightChanged=actions.setAction('lights',true),television=actions.visuals.televisions[0],tvChanged=television?actions.setAction(television.id,true):false;actions.update(0);actions.update(.1);
   const walkingOn=q.stage('walking-lights-tv-on',q.walking),lights=actions.visuals.lights.map(light=>light.intensity),tvState=television?actions.states.televisions[television.index]:null;
   a.setFurniture(false);const unfurnished=q.stage('walking-unfurnished',q.walking);
   a.setFurniture(true);q.stage('walking-furnished-restored',q.walking);
   q.planStages.push(walkingOff,walkingOn,unfurnished);return {walkingOff,walkingOn,unfurnished,lightChanged,lights,tvChanged,tvState,televisionCount:actions.visuals.televisions.length,restoredFurniture:a.withFurniture,walkingEnvelope:a.upper.visible&&a.ceiling.visible};
  });
  if(selectedScreens.has(id))await screenshot(id,'walking');
  const proof=await page.evaluate(()=>{
   const q=window.__apartmentsGPU,a=q.apartment,geometry=a.glazing.geometry,expected=a.facadeRegistration.windows.flatMap(w=>w.panes);let vertex=0,complete=true;const ranges=[];
   for(let index=0;index<expected.length;index++){const count=(expected[index].points.length-1)*6,from=vertex;for(let i=0;i<count;i++){const record=q.readPaneProvenance(geometry,vertex++);if(!record.complete||record.handle!=='@r_peredelkino'||record.paneIndex!==index)complete=false;}ranges.push({sourceBay:expected[index].sourceBay,startVertex:from,vertices:count});}
   let finite=true,unchanged=true;for(const [g,attributes]of q.sourceBuffers)for(const [key,source]of Object.entries(attributes)){const array=g.attributes[key].array;if(array.length!==source.length)unchanged=false;for(let i=0;i<array.length;i++){if(!Number.isFinite(array[i]))finite=false;if(array[i]!==source[i])unchanged=false;}}
   const physical=a.voxelAuthorship.verify();return {complete:complete&&vertex===geometry.attributes.position.count,recordedVertices:vertex,actualVertices:geometry.attributes.position.count,finite,unchanged,ranges,physicalComplete:physical.length===3&&physical.every(r=>r.complete),sourceArea:a.data.area,sourceRegistration:a.facadeRegistration.metadata};
  });
  const states=[initial.low,variants.walkingOff,variants.walkingOn,variants.unfurnished];
  add(id+' actual factory model submits finite lit geometry and compiles every visible shader state',{pass:states.every(s=>s.glError===0&&s.render.calls>0&&s.render.triangles>100&&s.programs.every(p=>p.runnable)&&s.shaderFailures===0&&s.pixelRange[1]>s.pixelRange[0])&&proof.finite,states});
  add(id+' walking, furniture, switched lights and television use the real apartment APIs',{pass:initial.spawn.free&&variants.walkingEnvelope&&variants.lightChanged&&variants.lights.length>0&&variants.lights.every(n=>n>0)&&variants.televisionCount>=1&&variants.tvChanged&&variants.tvState?.on&&variants.restoredFurniture&&variants.unfurnished.render.triangles<variants.walkingOn.render.triangles&&variants.walkingOff.pixelChecksum!==variants.walkingOn.pixelChecksum,spawn:initial.spawn,variants});
  add(id+' every exact registered glazing range remains recoverable and source geometry is byte-exact',{pass:proof.complete&&proof.unchanged&&proof.finite&&proof.physicalComplete,proof});
  const disposal=await page.evaluate(()=>{
   const q=window.__apartmentsGPU,a=q.apartment;q.actions.dispose();q.actions.dispose();a.dispose();a.dispose();a.root.removeFromParent();q.renderer.renderLists.dispose();q.renderer.render(q.scene,q.overhead);
   const bad=Array.from(q.disposes,([resource,n])=>({name:resource.name||resource.type||resource.constructor.name,n})).filter(r=>r.n!==1),memory={...q.renderer.info.memory},remainingPrograms=q.renderer.info.programs.map(program=>({id:program.id,name:program.name})),programs=remainingPrograms.length,glError=q.renderer.getContext().getError(),shadowTargets=q.shadowTargets();
   // Compare real warmed program object identities. r186 can give its retained
   // depth program an empty name, so names or arbitrary count allowances cannot
   // establish that every apartment shader has actually been released.
   const onlyKnownRendererPrograms=q.renderer.info.programs.every(program=>q.sharedRendererPrograms.has(program));
   const pass=bad.length===0&&memory.geometries===q.baseline.geometries&&memory.textures===q.baseline.textures&&programs===q.baseline.programs&&onlyKnownRendererPrograms&&JSON.stringify(shadowTargets)===JSON.stringify(q.baseline.shadowTargets)&&glError===0&&!q.scene.children.includes(a.root)&&a.surfaceProvenance.disposed;
   const result={pass,trackedResources:q.disposes.size,bad,memory,programs,remainingPrograms,onlyKnownRendererPrograms,shadowTargets,baseline:q.baseline,glError};q.apartment=null;q.actions=null;q.sourceBuffers.clear();q.disposes.clear();return result;
  });
  add(id+' teardown disposes each tracked resource once and returns GPU memory to the empty-scene baseline',disposal);
  plans.push({id,building:initial.building,floor:initial.floor,area:initial.area,source:initial.source,panes:initial.panes,stages:states.map(s=>({name:s.name,render:s.render,memory:s.memory,pixelChecksum:s.pixelChecksum})),disposal});
  console.log(JSON.stringify({stage:'apartment-complete',id,pass:checks.slice(-4).every(c=>c.pass),triangles:states.map(s=>s.render.triangles),resources:disposal.trackedResources}));
 }
 report.actualChecks=checks.length;report.shaderDiagnostics=await page.evaluate(()=>window.__apartmentsGPU.shaderFailures);
 report.pass=plans.length===17&&checks.length===70&&checks.every(c=>c.pass)&&errors.length===0&&shaderErrors.length===0&&badResources.length===0&&report.shaderDiagnostics.length===0;
}catch(error){fatal=String(error.stack||error);errors.push({plan:currentPlan,message:fatal});}
finally{
 if(page)await page.evaluate(()=>{const q=window.__apartmentsGPU;if(!q)return;q.actions?.dispose();q.apartment?.dispose();q.renderer.dispose();q.renderer.forceContextLoss();}).catch(error=>errors.push({plan:currentPlan,message:String(error)}));
 if(browser)await browser.close();report.actualChecks=checks.length;report.pass=report.pass&&!fatal&&errors.length===0&&shaderErrors.length===0&&badResources.length===0;
 await fs.writeFile(path.join(out,'apartments-render.json'),JSON.stringify(report,null,2));await fs.rm(profile,{recursive:true,force:true});
 console.log(JSON.stringify({stage:'apartments-gpu-complete',pass:report.pass,actualChecks:checks.length,apartments:plans.length,errors:errors.length,shaderErrors:shaderErrors.length,badResources:badResources.length,screens:screens.length}));if(!report.pass)process.exitCode=1;
}
