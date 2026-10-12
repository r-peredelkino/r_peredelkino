const fs=require('node:fs');
const puppeteer=require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const base=process.env.RP_QA_URL||'https://r-peredelkino.github.io/r_peredelkino',out=process.env.RP_QA_OUT||'/tmp/rodina-qa-live';fs.mkdirSync(out,{recursive:true});
 const browser=await puppeteer.launch({headless:true,executablePath:'/tmp/rodina-reference-qa-v26/chrome-arm64',userDataDir:out+'/publication-browser',args:['--no-sandbox','--disable-background-networking','--disable-component-update']});
 const page=await browser.newPage();await page.setCacheEnabled(false);page.setDefaultTimeout(90000);await page.setViewport({width:1500,height:1000});
 const checks=[],errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)bad.push({url:r.url(),status:r.status()});});
 const check=(name,result)=>{checks.push({name,...result});console.log(JSON.stringify(checks.at(-1)));if(!result.pass)throw Error(name);};
 try{
  await page.goto(base+'/index.html',{waitUntil:'load'});
  await page.evaluate(async()=>{const T=await import('./vendor/three.module.js'),prior=T.Scene.prototype.onBeforeRender;T.Scene.prototype.onBeforeRender=function(renderer,scene,camera,...args){prior?.call(this,renderer,scene,camera,...args);if(renderer.domElement.closest('#cluster-map'))window.__rp={renderer,scene,camera};};window.setMapView('district');});
  await page.waitForFunction(()=>window.__rp&&document.querySelectorAll('[data-plan-catalog] option').length===17);
  check('Publication identity and actual browser Three revision',await page.evaluate(async()=>{const T=await import('./vendor/three.module.js');return{pass:document.documentElement.dataset.publication==='37.1.0'&&T.REVISION==='186',publication:document.documentElement.dataset.publication,three:T.REVISION};}));
  await new Promise(r=>setTimeout(r,1000));
  check('Main renderer compiled programs without WebGL errors',await page.evaluate(()=>{const r=window.__rp.renderer,p=r.info.programs,bad=p.filter(p=>p.diagnostics?.runnable===false).map(p=>p.name);return{pass:p.length>0&&bad.length===0&&r.getContext().getError()===0,programs:p.length,bad,triangles:r.info.render.triangles};}));
  check('All 17 public apartment options preserved',await page.evaluate(()=>{const values=[...document.querySelectorAll('[data-plan-catalog] option')].map(o=>o.value).filter(Boolean);return{pass:values.length===17&&new Set(values).size===17,values};}));
  await page.screenshot({path:out+'/publication-masterplan.png'});
  await page.click('.genplan-about');await page.waitForFunction(()=>document.querySelector('.publication-about')?.open);
  check('About dialog exposes exact official and source links',await page.evaluate(()=>{const d=document.querySelector('.publication-about'),urls=[...d.querySelectorAll('a')].map(a=>a.href),expected=['https://rodina-peredelkino.ru/','https://rodinagroup.com/','https://github.com/r-peredelkino/r_peredelkino'];return{pass:d.open&&d.getAttribute('aria-labelledby')==='publication-title'&&urls.every((u,i)=>u===expected[i])&&urls.length===3,urls};}));
  check('About keyboard focus stays inside modal',await page.evaluate(()=>({pass:document.querySelector('.publication-about').contains(document.activeElement),focus:document.activeElement.tagName})));
  await page.screenshot({path:out+'/publication-about.png'});await page.keyboard.press('Escape');
  check('Escape closes About and restores launch focus',await page.evaluate(()=>({pass:!document.querySelector('.publication-about').open&&document.activeElement.matches('.genplan-about')})));
  for(const width of [390,374]){
   await page.setViewport({width,height:844,hasTouch:true});await page.click('.genplan-about');
   check('About fits '+width+'px and links have touch targets',await page.evaluate(()=>{const d=document.querySelector('.publication-about'),r=d.getBoundingClientRect(),links=[...d.querySelectorAll('a')].map(a=>a.getBoundingClientRect());return{pass:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&links.every(b=>b.height>=44),bounds:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},viewport:[innerWidth,innerHeight]};}));
   await page.screenshot({path:out+'/publication-mobile-'+width+'.png'});await page.keyboard.press('Escape');
  }
  await page.setViewport({width:1500,height:1000});
  for(const id of ['1-81','2-588','4-1071']){
   await page.select('[data-plan-catalog]',id);await page.click('[data-open-plan]');await page.waitForFunction(id=>document.querySelector('#model-viewport')?.userData?.apartment?.root.name.startsWith('Apartment '+id+' '),{},id);
   await page.click('#sheet [data-mode="2d"]');await page.waitForSelector('#model-source:not([hidden])');
   check('Public '+id+' original plan image loads',await page.evaluate(async()=>{const i=document.querySelector('#model-source img');await i.decode();return{pass:i.complete&&i.naturalWidth>=400,width:i.naturalWidth,height:i.naturalHeight,src:i.src};}));
   await page.click('#sheet [data-mode="3d"]');await page.click('#model-walk');await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.tour.enabled);
   check('Public '+id+' renders furnished geometry and safe walk',await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData,p=u.tour.position;return{pass:u.renderer.info.render.triangles>0&&u.apartment.withFurniture&&u.apartment.world.free(p.x,p.z)&&u.renderer.getContext().getError()===0&&!u.renderer.info.programs.some(p=>p.diagnostics?.runnable===false),programs:u.renderer.info.programs.length,furniture:u.apartment.data.furniture.length};}));
   await page.select('#model-viewport [data-apt-interaction]','apt-lights');await page.waitForFunction(()=>!document.querySelector('#model-viewport [data-apt-action]').disabled);await page.click('#model-viewport [data-apt-action]');await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.actions.visuals.lights.some(l=>l.intensity>0));
   check('Public '+id+' actual room lights switch on',await page.evaluate(()=>{const a=document.querySelector('#model-viewport').userData.actions;return{pass:a.states.lights.on&&a.visuals.lights.every(l=>l.intensity>0),lights:a.visuals.lights.length};}));
   const tv=await page.evaluate(()=>document.querySelector('#model-viewport').userData.actions.visuals.televisions[0].id);await page.select('#model-viewport [data-apt-interaction]',tv);await page.waitForFunction(()=>!document.querySelector('#model-viewport [data-apt-action]').disabled);await page.click('#model-viewport [data-apt-action]');
   await page.waitForFunction(id=>{const a=document.querySelector('#model-viewport').userData.actions,t=a.visuals.televisions.find(t=>t.id===id);return a.states.televisions[t.index].on&&t.material.emissiveIntensity>.8;},{},tv);
   check('Public '+id+' actual television switches on',await page.evaluate(id=>{const a=document.querySelector('#model-viewport').userData.actions,t=a.visuals.televisions.find(t=>t.id===id);return{pass:a.states.televisions[t.index].on&&t.material.map===t.texture&&t.material.emissiveIntensity>.8};},tv));
   const rest=await page.evaluate(()=>document.querySelector('#model-viewport').userData.actions.poi.find(p=>p.action==='apartment-pose').id);await page.select('#model-viewport [data-apt-interaction]',rest);await page.waitForFunction(()=>!document.querySelector('#model-viewport [data-apt-action]').disabled);await page.click('#model-viewport [data-apt-action]');await page.waitForFunction(id=>document.querySelector('#model-viewport').userData.actions.states.pose.id===id,{},rest);
   check('Public '+id+' resting camera activates',await page.evaluate(id=>({pass:document.querySelector('#model-viewport').userData.actions.states.pose.id===id}),rest));await page.screenshot({path:out+'/public-apartment-'+id+'.png'});await page.click('#model-viewport [data-apt-stand]');await page.waitForFunction(()=>!document.querySelector('#model-viewport').userData.tour.transitioning);await page.click('#model-viewport .apt-exit');await page.waitForFunction(()=>!document.querySelector('#model-viewport').userData.tour.enabled);await page.click('#sheet [data-apartment-close]');await page.waitForFunction(()=>!document.querySelector('#sheet').open);
  }
  await page.goto(base+'/walk/',{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.dataset.publication==='37.1.0');
  check('Historic walk link redirects to full canonical project',{pass:page.url()===base+'/index.html',url:page.url()});
  check('No script, shader or local resource errors',{pass:errors.length===0&&bad.length===0,errors,bad});
 }catch(e){errors.push(e.stack);await page.screenshot({path:out+'/publication-failure.png'}).catch(()=>{});}finally{
  const result={revision:37,publication:'37.1.0',base,checks,errors,bad,actualChecks:checks.length,minimumChecks:25,pass:checks.length>=25&&checks.every(c=>c.pass)&&errors.length===0&&bad.length===0};fs.writeFileSync(out+'/publication.json',JSON.stringify(result,null,2));await browser.close();if(!result.pass)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
