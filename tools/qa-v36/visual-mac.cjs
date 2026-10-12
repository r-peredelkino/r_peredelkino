const fs=require('node:fs'),puppeteer=require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{
 const out='/tmp/rodina-qa-v36';const browser=await puppeteer.launch({headless:true,executablePath:'/tmp/rodina-reference-qa-v26/chrome-arm64',userDataDir:out+'/visual-browser',args:['--no-sandbox','--disable-background-networking','--disable-component-update']});const page=await browser.newPage();page.setDefaultTimeout(90000);await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8096/index.html?view=genplan',{waitUntil:'load'});await page.evaluate(()=>window.setMapView('district'));await page.waitForFunction(()=>window.clusterCamera&&document.querySelector('#cluster-map')?.tourAPI);
  await page.evaluate(async()=>{document.querySelector('#welcome').hidden=true;document.body.classList.remove('welcome-open');const {setSolarSelection}=await import('./solar-clock.js?v=references36');setSolarSelection('2026-07-15',780,{mode:'manual'});});
  const delay=()=>new Promise(r=>setTimeout(r,350));
  async function open(action){await page.evaluate(action=>window.clusterCamera(action),action);await page.waitForFunction(()=>document.querySelector('.rp-showroom')?.userData?.amenities);await delay();}
  async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});}
  async function close(){await page.click('.rp-showroom [data-close]');await page.waitForFunction(()=>!document.querySelector('.rp-showroom'));}
  async function spot(id){await page.select('.rp-showroom [data-room-spot]',id);await page.click('.rp-showroom [data-guide-close]');await delay();}
  await open('lobby-room');await shot('lobby-overview');await spot('resident-lobby');await shot('lobby-walk');await spot('resident-lift');await shot('lift-hall');await spot('resident-handwash');await shot('wash-stroller');await close();
  await open('training');await shot('training-walk');await spot('resident-kids');await shot('kids-walk');await spot('resident-coffee');await shot('coffee-walk');await spot('resident-lounge-seat');await shot('lounge-walk');await close();
  await open('apartment-hall');await page.click('.rp-showroom [data-walk]');await delay();await shot('apartment-hall-walk');await close();
  await open('parking');await shot('parking-overview');await page.click('.rp-showroom [data-walk]');await delay();await shot('parking-walk');await close();
  await open('fitness');await shot('fitness-floor1-overview');await page.click('.rp-showroom [data-walk]');await delay();await shot('fitness-floor1-walk');await close();
  fs.writeFileSync(out+'/visual.json',JSON.stringify({revision:36,pass:errors.length===0,errors},null,2));
 }finally{await browser.close();}if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
