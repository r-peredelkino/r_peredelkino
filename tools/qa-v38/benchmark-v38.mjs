// Native paired renderer measurement. Both sides must use the same Three r186;
// render counters include shadow passes and are not a scene geometry inventory.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.RP_QA_PUPPETEER||'/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const output=process.env.RP_QA_OUT||path.join(os.tmpdir(),'rodina-qa-v38');
const baseline=process.env.RP_QA_BASELINE_URL||'http://127.0.0.1:8098/r_peredelkino/';
const candidate=process.env.RP_QA_BASE_URL||'http://127.0.0.1:8099/r_peredelkino/';
const executablePath=process.env.RP_QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const warmupMS=Number(process.env.RP_QA_BENCHMARK_WARMUP_MS)||3000,sampleMS=Number(process.env.RP_QA_BENCHMARK_SAMPLE_MS)||5000,minFrames=60;
const poses=[['courtyard',null],['forecourt',null],['facade',0]];
const mappings=[{profile:'full',baseline:'full',candidate:'full'},{profile:'balanced',baseline:'auto',candidate:'balanced'}];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={revision:38,samples:[],errors:[],resources:[],shaderErrors:[],checks:[],method:{
 viewport:[1500,1000],deviceScaleFactor:1,renderArea:[1500,1000],date:'2026-07-15',minutes:720,weather:'clear',life:true,
 threeRevision:186,chromeExecutable:executablePath,qualityMappings:mappings,pairedRepeats:2,order:['baseline,candidate','candidate,baseline'],
 warmupMS,sampleMS,minFrames,measurement:'Intervals between actual masterplan renders; CPU submission times are separately recorded. No GPU timer or guaranteed FPS claim.',
 counterScope:'Three r186 render counters include colour and shadow passes. Dynamic shadow cadence changes these counters without changing the number of static scene vertices.',
 balancedScope:'The baseline has no balanced preset: its fixed auto foliage mode is paired with the candidate balanced preset. Candidate balanced intentionally reduces shadow resolution and population.'
}};
await fs.mkdir(output,{recursive:true});
const profileDirectory=await fs.mkdtemp(path.join(output,'benchmark-v38-profile-'));
let browser=null,currentRun=null;
try{
 browser=await puppeteer.launch({headless:true,executablePath,userDataDir:profileDirectory,args:['--no-sandbox','--disable-background-networking','--disable-component-update']});
 report.nodeArchitecture=process.arch;report.chromeVersion=await browser.version();
 const page=await browser.newPage();await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});page.setDefaultTimeout(90000);
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'no-preference'}]);
 await page.evaluateOnNewDocument(()=>{try{localStorage.removeItem('rp.render-quality.v38');localStorage.removeItem('rp.forest-sound.v38');}catch{}});
 page.on('pageerror',error=>report.errors.push({run:currentRun,message:error.message}));
 page.on('console',message=>{if(message.type()==='error'&&/shader|VALIDATE_STATUS|LINK_STATUS|compile|WebGLProgram|WebGL.*(?:error|invalid)/i.test(message.text()))report.shaderErrors.push({run:currentRun,message:message.text()});});
 page.on('response',response=>{if([baseline,candidate].some(base=>response.url().startsWith(base))&&response.status()>=400)report.resources.push({run:currentRun,url:response.url(),status:response.status()});});
 for(const pair of [1,2])for(const mapping of mappings)for(const side of pair===1?['baseline','candidate']:['candidate','baseline']){
  const base=side==='baseline'?baseline:candidate,selectedQuality=mapping[side];currentRun={pair,side,profile:mapping.profile};
  const entry=new URL('index.html?view=genplan',base.endsWith('/')?base:base+'/').href;
  await page.goto(entry,{waitUntil:'load'});
  await page.waitForFunction(()=>typeof window.setMapView==='function');
  await page.evaluate(async()=>{
   const T=await import('./vendor/three.module.js');window.__rpThreeRevision=Number(T.REVISION);
   const before=T.Scene.prototype.onBeforeRender,after=T.Scene.prototype.onAfterRender;
   T.Scene.prototype.onBeforeRender=function(renderer,scene,camera,...args){
    before?.call(this,renderer,scene,camera,...args);
    if(renderer.domElement.closest('#cluster-map')&&scene.userData.solar){window.__rp={renderer,scene,camera};window.__rpRenderStart=performance.now();}
   };
   T.Scene.prototype.onAfterRender=function(renderer,scene,camera,...args){
    after?.call(this,renderer,scene,camera,...args);
    if(!renderer.domElement.closest('#cluster-map')||!scene.userData.solar||!window.__rpCapture)return;
    const capture=window.__rpCapture,start=window.__rpRenderStart;
    if(capture.lastStart!==null){capture.intervals.push(start-capture.lastStart);capture.cpuSubmission.push(performance.now()-start);capture.calls.push(renderer.info.render.calls);capture.triangles.push(renderer.info.render.triangles);}
    capture.lastStart=start;capture.firstStart??=start;
   };
   window.setMapView('district');
  });
  await page.waitForFunction(()=>window.__rp&&document.querySelector('#cluster-map')?.solarEnvironment);
  const actualRevision=await page.evaluate(()=>Number(document.documentElement.dataset.release));
  const expected=Number(side==='baseline'?process.env.RP_QA_BASELINE_REVISION||37:process.env.RP_QA_REVISION||38);
  if(actualRevision!==expected)throw Error(`${side} release ${actualRevision}; expected ${expected}`);
  await page.evaluate(({selectedQuality,side})=>{
   const host=document.querySelector('#cluster-map'),environment=host.solarEnvironment;
   Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:'1500px',height:'1000px',minHeight:'1000px',maxHeight:'1000px',zIndex:'99999'});
   const weather=environment.panel.querySelector('[data-weather]');weather.value='clear';weather.dispatchEvent(new Event('change',{bubbles:true}));environment.setDate('2026-07-15',720);
   if(side==='candidate')environment.setQuality(selectedQuality);
   else{const control=environment.panel.querySelector('[data-quality]');control.value=selectedQuality;control.dispatchEvent(new Event('change',{bubbles:true}));}
   const lifeButton=document.querySelector('#cluster-life');if(lifeButton?.getAttribute('aria-pressed')==='false')window.clusterCamera('life');
   host.communityModel?.life.setEnabled(true);
  },{selectedQuality,side});
  await page.waitForFunction(quality=>document.querySelector('#cluster-map').solarEnvironment.panel.dataset.renderQuality===quality,{},selectedQuality);
  for(const [action,building] of poses){
   await page.evaluate(([action,building])=>window.clusterCamera(action,building),[action,building]);await wait(warmupMS);
   const sample=await page.evaluate(({sampleMS,minFrames})=>new Promise((resolve,reject)=>{
    const capture={intervals:[],cpuSubmission:[],calls:[],triangles:[],firstStart:null,lastStart:null};window.__rpCapture=capture;const deadline=performance.now()+60000;
    function sampleTick(now){
     if(now>deadline){window.__rpCapture=null;reject(Error('Not enough actual renders for the benchmark'));return;}
     if(capture.intervals.length<minFrames||capture.firstStart===null||capture.lastStart-capture.firstStart<sampleMS){requestAnimationFrame(sampleTick);return;}
     window.__rpCapture=null;
     const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;return{mean,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],min:sorted[0],max:sorted.at(-1)};};
     const {renderer,scene,camera}=window.__rp,host=document.querySelector('#cluster-map'),environment=host.solarEnvironment,gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
     const programs=(renderer.info.programs||[]).filter(program=>program.diagnostics?.runnable===false).map(program=>({name:program.name,diagnostics:program.diagnostics}));
     resolve({frames:capture.intervals.length,elapsedMS:capture.lastStart-capture.firstStart,frameMS:stats(capture.intervals),cpuSubmissionMS:stats(capture.cpuSubmission),renderCalls:stats(capture.calls),renderTriangles:stats(capture.triangles),glError:gl.getError(),shaderProgramsNotRunnable:programs,
      gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),threeRevision:window.__rpThreeRevision,
      drawingBuffer:[renderer.domElement.width,renderer.domElement.height],cssCanvas:[renderer.domElement.clientWidth,renderer.domElement.clientHeight],pixelRatio:renderer.getPixelRatio(),
      selectedQuality:environment.panel.dataset.renderQuality,quality:environment.getQuality?.()??null,shadowSize:environment.daylightRig.sun.shadow.mapSize.x,shadowFit:scene.userData.architecturalLighting?.shadowFit,
      shadowFitCount:scene.userData.architecturalLighting?.fitCount??null,shadowRedrawCount:scene.userData.architecturalLighting?.redrawCount??null,
      population:host.communityModel?.life.stats??host.communityModel?.life.getStats?.()??null,traffic:host.communityModel?.traffic.getStats?.()??null,
      camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom,fov:camera.fov??null,left:camera.left??null,right:camera.right??null,top:camera.top??null,bottom:camera.bottom??null}});
    }
    requestAnimationFrame(sampleTick);
   }),{sampleMS,minFrames});
   report.samples.push({pair,side,profile:mapping.profile,base,revision:actualRevision,action,building,...sample});
   console.log(JSON.stringify({pair,side,profile:mapping.profile,action,frames:sample.frames,meanMS:sample.frameMS.mean,medianMS:sample.frameMS.median,p95MS:sample.frameMS.p95,gpu:sample.gpu,drawingBuffer:sample.drawingBuffer,shadowSize:sample.shadowSize}));
  }
 }
}catch(error){report.errors.push({run:currentRun,message:error.stack});}
finally{
 const identical=(a,b)=>JSON.stringify(a)===JSON.stringify(b),mean=(values)=>values.reduce((a,b)=>a+b,0)/values.length;
 for(const pair of [1,2])for(const mapping of mappings)for(const [action]of poses){
  const a=report.samples.find(s=>s.pair===pair&&s.side==='baseline'&&s.profile===mapping.profile&&s.action===action),b=report.samples.find(s=>s.pair===pair&&s.side==='candidate'&&s.profile===mapping.profile&&s.action===action);
  if(!a||!b){report.checks.push({name:`${pair}/${mapping.profile}/${action} camera pair`,pass:false,missing:true});continue;}
  const positionError=Math.hypot(...a.camera.position.map((v,i)=>v-b.camera.position[i])),rotationError=Math.min(Math.hypot(...a.camera.quaternion.map((v,i)=>v-b.camera.quaternion[i])),Math.hypot(...a.camera.quaternion.map((v,i)=>v+b.camera.quaternion[i])));
  report.checks.push({name:`${pair}/${mapping.profile}/${action} camera and canvas pair`,pass:positionError<1e-5&&rotationError<1e-5&&a.camera.zoom===b.camera.zoom&&a.camera.fov===b.camera.fov&&a.camera.left===b.camera.left&&a.camera.right===b.camera.right&&a.camera.top===b.camera.top&&a.camera.bottom===b.camera.bottom&&identical(a.drawingBuffer,b.drawingBuffer)&&identical(a.cssCanvas,b.cssCanvas)&&a.gpu===b.gpu&&a.threeRevision===186&&b.threeRevision===186,positionError,rotationError,baselineDrawingBuffer:a.drawingBuffer,candidateDrawingBuffer:b.drawingBuffer});
 }
 report.checks.push({name:'Every measurement used the physical 1500 × 1000 canvas and completed enough actual rendered frames',pass:report.samples.length===24&&report.samples.every(s=>s.frames>=minFrames&&s.elapsedMS>=sampleMS&&identical(s.cssCanvas,[1500,1000])&&identical(s.drawingBuffer,[1500,1000])&&Number.isFinite(s.frameMS.mean)&&s.frameMS.mean>0)});
 report.checks.push({name:'Native Apple Silicon GPU, same r186, no shader/GL/page/asset errors',pass:process.arch==='arm64'&&report.samples.every(s=>!/swiftshader|llvmpipe|software/i.test(s.gpu)&&s.threeRevision===186&&s.glError===0&&s.shaderProgramsNotRunnable.length===0)&&report.shaderErrors.length===0&&report.errors.length===0&&report.resources.length===0});
 report.pass=report.checks.every(c=>c.pass);report.summary=[];
 for(const mapping of mappings)for(const [action]of poses){
  const a=report.samples.filter(s=>s.side==='baseline'&&s.profile===mapping.profile&&s.action===action),b=report.samples.filter(s=>s.side==='candidate'&&s.profile===mapping.profile&&s.action===action);if(a.length!==2||b.length!==2)continue;
  const before=mean(a.map(s=>s.frameMS.mean)),after=mean(b.map(s=>s.frameMS.mean));report.summary.push({profile:mapping.profile,action,baselineQuality:mapping.baseline,candidateQuality:mapping.candidate,baselineMeanMS:before,candidateMeanMS:after,frameTimeReductionPercent:(before-after)/before*100,pairedChangesPercent:[1,2].map(pair=>{const old=a.find(s=>s.pair===pair).frameMS.mean,next=b.find(s=>s.pair===pair).frameMS.mean;return(old-next)/old*100;}),baselineRenderCalls:mean(a.map(s=>s.renderCalls.mean)),candidateRenderCalls:mean(b.map(s=>s.renderCalls.mean)),baselineShadowSize:a[0].shadowSize,candidateShadowSize:b[0].shadowSize});
 }
 await fs.writeFile(path.join(output,'benchmark-v38.json'),JSON.stringify(report,null,2)+'\n');await fs.writeFile(path.join(output,'benchmark-v38-summary.json'),JSON.stringify({pass:report.pass,method:report.method,chromeVersion:report.chromeVersion,nodeArchitecture:report.nodeArchitecture,gpu:[...new Set(report.samples.map(s=>s.gpu))],checks:report.checks,summary:report.summary,errors:report.errors,shaderErrors:report.shaderErrors,resources:report.resources},null,2)+'\n');
 await browser?.close();await fs.rm(profileDirectory,{recursive:true,force:true});console.log(JSON.stringify({pass:report.pass,samples:report.samples.length,output,errors:report.errors}));if(!report.pass)process.exitCode=1;
}
