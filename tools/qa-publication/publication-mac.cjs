const fs=require('node:fs');
const puppeteer=require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const base=process.env.RP_QA_URL||'http://127.0.0.1:8098/r_peredelkino',out=process.env.RP_QA_OUT||'/tmp/rodina-qa-publication';fs.mkdirSync(out,{recursive:true});
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
  await page.goto(base+'/walk/',{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.dataset.publication==='37.1.0');
  check('Historic walk link redirects to full canonical project',{pass:page.url()===base+'/index.html',url:page.url()});
  check('No script, shader or local resource errors',{pass:errors.length===0&&bad.length===0,errors,bad});
 }catch(e){errors.push(e.stack);await page.screenshot({path:out+'/publication-failure.png'}).catch(()=>{});}finally{
  const result={revision:37,publication:'37.1.0',base,checks,errors,bad,actualChecks:checks.length,minimumChecks:10,pass:checks.length>=10&&checks.every(c=>c.pass)&&errors.length===0&&bad.length===0};fs.writeFileSync(out+'/publication.json',JSON.stringify(result,null,2));await browser.close();if(!result.pass)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
