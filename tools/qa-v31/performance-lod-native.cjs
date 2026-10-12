// Isolated scene A/B on the actual GPU. This does not measure the complete app.
// Usage: node performance-lod-native.cjs OUTPUT_LABEL HARNESS_URL
const fs=require('node:fs'),path=require('node:path');
const puppeteer=require(process.env.RODINA_PUPPETEER_PATH||'/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const label=process.argv[2]||'planting-lod-native',url=process.argv[3];
if(!url)throw new Error('Pass the staged visual-scene-harness.html URL');
if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('Use a plain output label');
const output=path.join(__dirname,label);fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.RODINA_CHROME_PATH||'/tmp/rodina-reference-qa-v26/chrome-arm64',userDataDir:path.join(output,'chrome-profile'),args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run']});
 const page=await browser.newPage(),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});
 const report={scope:'Isolated Three.js scene A/B, same runtime, camera and light; not full-app FPS',url,viewport:[1500,1000],errors,views:[]};
 try{
  await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.qa?.ready);await page.evaluate(()=>window.qa.model.arenaMedia?.referenceReady);
  report.gpu=await page.evaluate(()=>window.qa.rendererInfo);
  await page.evaluate(async()=>{
   const T=await import('./vendor/three.module.js'),previous=T.Scene.prototype.onBeforeRender;
   T.Scene.prototype.onBeforeRender=function(renderer,scene,camera,...args){previous?.call(this,renderer,scene,camera,...args);window.__plantingPerf={renderer,scene,camera};};
  });
  for(const name of ['forecourt-source-day','promenade-eye','arena-source-matched']){
   const result={name,modes:[]};
   for(const mode of ['full','auto','full','auto']){
    const sample=await page.evaluate(async({name,mode})=>{
     const batches=window.qa.model.publicRealm.forecourt.landscape.spatialInstances;batches.forEach(b=>b.setDetail(mode));await window.qa.render(name);
     const p=window.__plantingPerf,intervals=[];let previous=null,frame=0;
     await new Promise(resolve=>{function tick(t){if(previous!==null&&frame>10)intervals.push(t-previous);previous=t;p.renderer.render(p.scene,p.camera);frame++;if(frame<92)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
     const sorted=intervals.slice().sort((a,b)=>a-b),percentile=q=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))];
     return{mode,medianMS:percentile(.5),p95MS:percentile(.95),maxMS:sorted.at(-1),samples:intervals.length,render:{...p.renderer.info.render},memory:{...p.renderer.info.memory},glError:p.renderer.getContext().getError(),planting:batches.map(b=>({name:b.source.name,...b.getDetail()})),png:p.renderer.domElement.toDataURL('image/png')};
    },{name,mode});
    const pngName=`${name}-${mode}-${result.modes.filter(m=>m.mode===mode).length+1}.png`;fs.writeFileSync(path.join(output,pngName),Buffer.from(sample.png.split(',')[1],'base64'));delete sample.png;sample.png=pngName;result.modes.push(sample);
    fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({...report,views:[...report.views,result]},null,2));console.log(JSON.stringify({name,mode,medianMS:sample.medianMS,p95MS:sample.p95MS,triangles:sample.render.triangles,draws:sample.render.calls,glError:sample.glError}));
   }
   report.views.push(result);
  }
  report.pass=errors.length===0&&report.views.every(v=>v.modes.every(m=>m.glError===0));fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
