// Real welcome/map UI QA for release 29. Observe the rendered scenes; operate UI.
// Candidate: node forecourt-live-mac.cjs candidate-ui29 http://127.0.0.1:8085/ 29
// Installed: node forecourt-live-mac.cjs installed-ui29 http://127.0.0.1:8080/ 29
// Writes <script-directory>/<label>/results.json. No screenshot or image exports.
// RODINA_PUPPETEER_PATH and RODINA_CHROME_PATH optionally select installed tools.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

async function installForecourtObserver(moduleURL){
 const THREE=await import(moduleURL||new URL('./vendor/three.module.js',location.href).href);
 window.__forecourtRestore?.();
 const prototype=THREE.Scene.prototype,own=Object.getOwnPropertyDescriptor(prototype,'onBeforeRender'),previous=prototype.onBeforeRender,frames={},errors={welcome:[],map:[]};
 function observer(renderer,scene,camera,...args){
  const value=typeof previous==='function'?previous.call(this,renderer,scene,camera,...args):undefined;
  const canvas=renderer?.domElement,surface=canvas?.closest?.('#welcome-3d')?'welcome':canvas?.closest?.('#cluster-map')?'map':null;
  if(surface)frames[surface]={renderer,scene,camera,canvas,at:performance.now(),sequence:(frames[surface]?.sequence||0)+1};
  return value;
 }
 Object.defineProperty(prototype,'onBeforeRender',{configurable:own?.configurable??true,enumerable:own?.enumerable??false,writable:true,value:observer});
 const effective=o=>{if(!o)return false;for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
 const stats=root=>{
  if(!root)return null;let meshCount=0,visibleMeshCount=0,instances=0;const materials=new Map(),sourceIds=new Set(),idsByType=new Map(),instanceCounts={};
  root.traverse(o=>{if(!o.isMesh)return;meshCount++;if(effective(o))visibleMeshCount++;if(o.isInstancedMesh){instances+=o.count;if(o.userData.type)instanceCounts[o.userData.type]=(instanceCounts[o.userData.type]??0)+o.count;}
   const types=o.userData.types??(o.userData.type?[o.userData.type]:[]);for(const id of o.userData.sourceIds??[])sourceIds.add(id);
   for(const type of types){let ids=idsByType.get(type);if(!ids){ids=new Set();idsByType.set(type,ids);}for(const id of o.userData.sourceIds??[])ids.add(id);}
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&!materials.has(m.uuid))materials.set(m.uuid,{name:m.name||o.name,color:m.color?.getHexString(),opacity:m.opacity,transparent:m.transparent,roughness:m.roughness,emissive:m.emissive?.getHexString(),emissiveIntensity:m.emissiveIntensity??0,strength:m.uniforms?.strength?.value??null,wetness:m.uniforms?.wetness?.value??null});
  });
  // Material batching combines several geometric part types and their source
  // IDs in one mesh. Count logical source objects only when their IDs are
  // present in that actual geometry; a mesh part name is not an object type.
  const renderedObjectsByType=new Map();
  for(const object of root.userData.layoutObjects??[]){
   if(!sourceIds.has(object.id))continue;
   let ids=renderedObjectsByType.get(object.type);if(!ids){ids=new Set();renderedObjectsByType.set(object.type,ids);}ids.add(object.id);
  }
  const list=[...materials.values()],metadata=root.userData.neighborBuildings;
  return{name:root.name,exists:true,visible:effective(root),meshCount,visibleMeshCount,instances,referenceVersion:root.userData.referenceVersion??null,counts:root.userData.counts??null,
   sourceObjectCount:sourceIds.size,sourceCountsByType:Object.fromEntries([...idsByType].map(([type,ids])=>[type,ids.size])),instanceCounts,
   renderedSourceCountsByType:Object.fromEntries([...renderedObjectsByType].map(([type,ids])=>[type,ids.size])),
   renderedSourceIdsByType:Object.fromEntries([...renderedObjectsByType].map(([type,ids])=>[type,[...ids].sort()])),
   version:metadata?.version,buildingCount:metadata?.buildingCount,footprintVertexCount:metadata?.footprintVertexCount,
   buildings:metadata?.buildings?.map(b=>({id:b.id,osmWayId:b.osmWayId,address:b.address,floors:b.floors,height:b.height,vertices:b.footprintEN?.length})),
   opaque:list.every(m=>m.opacity===1&&m.transparent===false),emissiveSum:list.filter(m=>m.emissive&&m.emissive!=='000000').reduce((sum,m)=>sum+m.emissiveIntensity,0),materials:list};
 };
 window.__forecourtRead=surface=>{
  const frame=frames[surface];if(!frame)return null;
  const find=name=>frame.scene.getObjectByName(name),context=find('Streets, surrounding blocks and forest'),forest=find('Continuous mature pine forest behind the sales office'),houses=find('Addressed neighbouring houses on OSM polygons');
  const localAccess=find('Published courtyard access roads around addressed neighbours'),transport=find('Georeferenced Borovskoye / Sholokhova transport and four metro entrances'),traffic=find('Directed traffic on OSM roads, smooth permitted connectors and protected phases');
  let architecture,landscape,cafes,roadside;frame.scene.traverse(o=>{if(o.userData.type==='forecourt-architecture')architecture=o;if(o.userData.type==='forecourt-landscape')landscape=o;if(o.userData.type==='forecourt-cafes')cafes=o;if(o.userData.forecourtRoadside)roadside=o;});
  const landscapeStats=stats(landscape),architectureStats=stats(architecture),cafeStats=stats(cafes),roadsideStats=stats(roadside),roadsideMetadata=roadside?.userData.forecourtRoadside;
  const named=(s,name)=>s?.materials.find(m=>m.name===name),magenta=named(landscapeStats,'Thin magenta physical paving inlays and rigid rod tips'),cyan=named(landscapeStats,'Cyan rigid media columns');
  const spill=landscapeStats?.materials.find(m=>m.strength!==null),rings=architectureStats?.materials.find(m=>m.emissive==='dc36fa'),terrace=named(cafeStats,'Continuous dark stone cafe terrace')??cafeStats?.materials.find(m=>m.name.includes('cafe-apron'));
  const glError=frame.renderer.getContext().getError();if(glError&&errors[surface].length<32)errors[surface].push({sequence:frame.sequence,error:glError});
  const direction=new THREE.Vector3();frame.camera.getWorldDirection(direction);const rect=frame.canvas.getBoundingClientRect(),host=document.querySelector(surface==='welcome'?'#welcome-3d':'#cluster-map'),hud=host?.querySelector('.tour-hud');
  return{surface,sequence:frame.sequence,at:frame.at,lastFrameAgeMS:performance.now()-frame.at,connected:frame.canvas.isConnected,
   camera:{position:frame.camera.position.toArray(),direction:direction.toArray(),type:frame.camera.type,fov:frame.camera.fov??null,aspect:frame.camera.aspect??null,zoom:frame.camera.zoom},
   canvas:{width:frame.canvas.width,height:frame.canvas.height,cssWidth:rect.width,cssHeight:rect.height},context:context?{visible:effective(context),children:context.children.length}:null,
   forest:forest?{visible:effective(forest),parent:forest.parent?.name}:null,houses:stats(houses),transport:transport?{visible:effective(transport),version:transport.userData.transport?.version}:null,
   localAccess:localAccess?{visible:effective(localAccess),roadCount:localAccess.userData.localAccess?.roadCount}:null,traffic:traffic?{visible:effective(traffic)}:null,
   salesOffice:stats(find('Sales office, forest forecourt and future parking approach')),
   forecourt:{architecture:architectureStats,landscape:landscapeStats,cafes:cafeStats,roadside:roadsideStats?{...roadsideStats,metadata:{version:roadsideMetadata.version,areaCount:roadsideMetadata.areaCount,parkedCarCount:roadsideMetadata.parkedCarCount,officeParking:roadsideMetadata.officeParking,roadAxisChanges:roadsideMetadata.roadAxisChanges}}:null,
    lighting:{magenta:magenta?.emissiveIntensity??null,cyan:cyan?.emissiveIntensity??null,rings:rings?.emissiveIntensity??null,spill:spill?.strength??null,wetness:spill?.wetness??null,cafeTerraceRoughness:terrace?.roughness??null}},
   tour:{active:Boolean(host?.classList.contains('tour-active')),hudVisible:Boolean(hud&&!hud.hidden),status:hud?.querySelector('.tour-status')?.textContent??null,selectedPlace:hud?.querySelector('[data-tour-place][aria-pressed="true"]')?.textContent??null},glError,glErrors:errors[surface].slice()};
 };
 window.__forecourtRestore=()=>{if(prototype.onBeforeRender===observer){if(own)Object.defineProperty(prototype,'onBeforeRender',own);else delete prototype.onBeforeRender;}delete window.__forecourtRead;delete window.__forecourtRestore;};
}

async function run(){
 const puppeteer=require(process.env.RODINA_PUPPETEER_PATH||'/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
 const label=process.argv[2]||'candidate-ui29',base=process.argv[3]||'http://127.0.0.1:8085/',version=Number(process.argv[4]||29);
 assert(/^[a-z0-9_-]+$/i.test(label),'Use a simple output label');assert.equal(version,29,'This audit expects forecourt release 29; neighbouring-house metadata stays 28.');
 const directory=path.join(__dirname,label);fs.mkdirSync(directory,{recursive:true});const appOrigin=new URL(base).origin,isApp=url=>{try{return new URL(url).origin===appOrigin;}catch{return false;}};
 const result={label,base,version,startedUtc:new Date().toISOString(),steps:[],pageErrors:[],consoleErrors:[],failedRequests:[],badResponses:[],observer:'Scene.onBeforeRender; read-only scene observation, actual UI controls; no model/camera/material overrides',imageExports:false,pass:false};
 const save=()=>fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(result,null,2));
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.RODINA_CHROME_PATH||'/tmp/rodina-reference-qa-v26/chrome-arm64',userDataDir:path.join(__dirname,'chrome-forecourt-ui-'+label),args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--no-first-run']});let page;
 try{
  page=await browser.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});await page.setCacheEnabled(false);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.evaluateOnNewDocument(()=>localStorage.removeItem('rodina-welcome-v1'));
  page.on('pageerror',e=>result.pageErrors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
  page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')result.failedRequests.push({url:r.url(),error:r.failure(),app:isApp(r.url())});});page.on('response',r=>{if(r.status()>=400)result.badResponses.push({url:r.url(),status:r.status(),app:isApp(r.url())});});
  const read=surface=>page.evaluate(surface=>window.__forecourtRead?.(surface),surface);
  const waitFresh=async surface=>{const since=await page.evaluate(()=>performance.now());await page.waitForFunction(({surface,since})=>{const s=window.__forecourtRead?.(surface);return s?.connected&&s.at>since&&s.lastFrameAgeMS<1500;},{timeout:60000},{surface,since});return read(surface);};
  const uiClick=async selector=>{await page.waitForSelector(selector,{visible:true,timeout:30000});const element=await page.$(selector);try{await element.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await page.waitForFunction(el=>{if(!el.isConnected)return false;const r=el.getBoundingClientRect();if(!r.width||!r.height)return false;const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===el||el.contains(hit);},{timeout:10000,polling:'raf'},element);await element.click();}finally{await element.dispose();}};
  const panelOpen=async(selector,wanted)=>{if(await page.$eval(selector,el=>el.open)!==wanted)await uiClick(selector+' summary');assert.equal(await page.$eval(selector,el=>el.open),wanted);};
  const noOverflow=async()=>{const m=await page.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,scrollX,scrollY}));assert(m.documentWidth<=m.width+1,`Horizontal document overflow: ${JSON.stringify(m)}`);assert.equal(m.scrollX,0,'Unexpected horizontal scroll');return m;};
  const cameraError=(state,preset)=>{const p=state.camera.position,d=state.camera.direction,delta=preset.target.map((v,i)=>v-p[i]),along=delta.reduce((s,v,i)=>s+v*d[i],0);return{position:Math.hypot(...p.map((v,i)=>v-preset.position[i])),targetRay:Math.hypot(...delta.map((v,i)=>v-along*d[i])),targetInFront:along>0};};
  const waitCamera=async(surface,preset,orthographic=false)=>{
   await page.waitForFunction(({surface,preset,orthographic})=>{const s=window.__forecourtRead?.(surface);if(!s?.connected||s.lastFrameAgeMS>1500)return false;const p=s.camera.position,d=s.camera.direction,delta=preset.target.map((v,i)=>v-p[i]),along=delta.reduce((sum,v,i)=>sum+v*d[i],0);return Math.hypot(...p.map((v,i)=>v-preset.position[i]))<.08&&along>0&&Math.hypot(...delta.map((v,i)=>v-along*d[i]))<.08&&(!orthographic||Math.abs(s.camera.zoom-preset.zoom)<1e-6);},{timeout:60000},{surface,preset,orthographic});
   const state=await waitFresh(surface),error=cameraError(state,preset);assert(error.position<.08&&error.targetRay<.08&&error.targetInFront,'Camera matches imported served preset');
   if(orthographic){assert.equal(state.camera.type,'OrthographicCamera');assert(Math.abs(state.camera.zoom-preset.zoom)<1e-6);}else{assert.equal(state.camera.type,'PerspectiveCamera');const fitted=Math.min(90,2*Math.atan(Math.tan(preset.fov*Math.PI/360)*Math.max(1,result.referenceAspect/state.camera.aspect))*180/Math.PI);assert(Math.abs(state.camera.fov-fitted)<.03,'Welcome FOV matches the actual preset/aspect rule');}
   state.expectedCamera={preset,errors:error};return state;
  };
  const expectedIds=[41278293,41278310,41278378,41277643,27791393,41277477,41277322,41277248,41278780,41278786,41277631];
  const assertHouses=state=>{const h=state.houses;assert(h?.exists,'Addressed neighbouring houses are present');assert.equal(h.version,28,'Neighbouring-house source revision is still 28');assert.equal(h.buildingCount,11);assert.equal(h.footprintVertexCount,139);assert.deepEqual(h.buildings.map(b=>b.id),expectedIds.map(id=>'osm-way-'+id));assert.equal(h.opaque,true);};
  const assertForecourt=(state,contextVisible=true)=>{const f=state.forecourt;for(const part of['architecture','landscape','cafes']){assert(f[part]?.exists,part+' is present in the actual rendered scene');assert.equal(f[part].referenceVersion,29);assert.equal(f[part].visible,true);assert(f[part].meshCount>0);}
   assert.equal(f.architecture.counts.pavilions,1);assert.equal(f.architecture.counts.canopies,3);assert.equal(f.architecture.counts.rings,3);assert.equal(f.architecture.counts.lamps,16);
   assert.equal(f.architecture.counts.socialGroups,2);assert.equal(f.architecture.counts.socialTables,1);assert.equal(f.architecture.counts.socialChairs,3);
   assert.equal(f.architecture.renderedSourceCountsByType['social-table'],1);assert.equal(f.architecture.renderedSourceCountsByType['social-chair'],3);
   assert.deepEqual(f.architecture.renderedSourceIdsByType['social-table'],['forecourt-yellow-pocket-table']);
   assert.deepEqual(f.architecture.renderedSourceIdsByType['social-chair'],['forecourt-yellow-canopy-chair-front','forecourt-yellow-pocket-chair-front','forecourt-yellow-pocket-chair-left']);
   assert(f.architecture.sourceCountsByType['yellow-social-tabletop']>0&&f.architecture.sourceCountsByType['yellow-social-chair-seat']>0,'Actual yellow tabletop and chair-seat geometry is present after material batching');
   assert.equal(f.landscape.sourceCountsByType['rigid-luminous-column'],18);assert.equal(f.landscape.sourceCountsByType['paving-inlay'],25);assert.equal(f.cafes.sourceCountsByType['cafe-fabric-roof'],10);assert.equal(f.cafes.instanceCounts['cafe-tabletop'],25);assert.equal(f.cafes.instanceCounts['cafe-chair-shell'],54);
   assert(f.roadside?.exists);assert.equal(f.roadside.metadata.version,29);assert.equal(f.roadside.metadata.roadAxisChanges,0);assert.equal(f.roadside.metadata.parkedCarCount,result.expectedRoadsideCars);assert.equal(f.roadside.metadata.officeParking.bayCount,9);assert.equal(f.roadside.visible,contextVisible);assert.equal(state.salesOffice?.visible,true,'Separate forest-side sales office stays present');assert.equal(state.salesOffice.name,'Sales office, forest forecourt and future parking approach');
   assert([f.lighting.magenta,f.lighting.cyan,f.lighting.rings,f.lighting.spill,f.lighting.wetness,f.lighting.cafeTerraceRoughness].every(Number.isFinite),'Observe the actual emissive materials, terrace surface and spill uniforms');
  };
  const assertContext=(state,visible)=>{assert.equal(state.context?.visible,visible);assert.equal(state.forest?.visible,true,'Forest remains independent of the context toggle');assert.equal(state.houses?.visible,visible);assert.equal(state.transport?.visible,visible);assert.equal(state.localAccess?.visible,visible);assert.equal(state.localAccess?.roadCount,50);assert.equal(state.traffic?.visible,visible);assertForecourt(state,visible);};
  const assertNight=(night,day)=>{const n=night.forecourt.lighting,d=day.forecourt.lighting;assert(n.magenta>d.magenta+1.2&&n.cyan>d.cyan+1&&n.rings>d.rings+2,'LED rods, magenta inlays and suspended rings respond to the actual night control');assert(n.spill>.65&&d.spill===0,'Ground spill turns on at night');};
  const record=async(name,state,extra={})=>{assert.equal(state.glError,0,name+' GL');assert.deepEqual(state.glErrors,[],name+' cumulative GL errors');const viewport=await noOverflow();result.steps.push({name,...state,viewport,...extra});save();console.log(JSON.stringify({step:name,viewport:[viewport.width,viewport.height],camera:state.camera.position,context:state.context?.visible,houses:state.houses?.buildingCount,led:state.forecourt?.lighting,tour:state.tour?.selectedPlace,glError:state.glError}));};
  const welcomePanel='#welcome details.env-panel',mapPanel='#cluster-map ~ details.env-panel';
  const mapReady=()=>page.waitForFunction(()=>{const host=document.querySelector('#cluster-map'),panel=host?.parentElement?.querySelector('details.env-panel'),frame=window.__forecourtRead?.('map');return typeof window.clusterCamera==='function'&&host?.isConnected&&panel?.isConnected&&frame?.connected&&frame.lastFrameAgeMS<1500;},{timeout:60000});
  const setNight=async(panel,surface)=>{await panelOpen(panel,true);await page.$eval(panel+' [data-time]',el=>{el.value='22:00';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForFunction(panel=>document.querySelector(panel+' [data-night]')?.textContent==='Солнце за горизонтом',{},panel);await panelOpen(panel,false);return waitFresh(surface);};
  const setDay=async(panel,surface)=>{await panelOpen(panel,true);await uiClick(panel+' [data-season="today"]');await page.waitForFunction(panel=>document.querySelector(panel+' [data-time]')?.value==='12:00'&&document.querySelector(panel+' [data-weather]')?.value==='clear',{},panel);await panelOpen(panel,false);return waitFresh(surface);};
  const clickPlaza=async host=>{const id=await page.$$eval(host+' [data-tour-place]',els=>els.find(el=>el.textContent.trim()==='Площадь')?.dataset.tourPlace);assert(id!==undefined,'Actual tour destination button named Площадь exists');await uiClick(host+' [data-tour-place="'+id+'"]');};
  const assertPlaza=state=>{const p=result.plazaDestination.point;assert(state.tour.active&&state.tour.hudVisible);assert.equal(state.tour.selectedPlace,'Площадь');assert.equal(state.camera.type,'PerspectiveCamera');assert.equal(state.camera.fov,70);assert(Math.hypot(state.camera.position[0]-p[0],state.camera.position[2]-p[1])<.02,'Tour starts at the imported clear plaza point');assert(Math.abs(state.camera.position[1]-(result.plazaGroundY+1.68))<.005,'Tour eye height follows the same road-edge grade');assertForecourt(state,true);};
  const stepForward=async surface=>{const before=await waitFresh(surface);await page.keyboard.down('ArrowUp');try{await page.waitForFunction(({surface,start})=>{const s=window.__forecourtRead?.(surface);return s?.tour.active&&Math.hypot(s.camera.position[0]-start[0],s.camera.position[2]-start[2])>.05;},{timeout:15000},{surface,start:before.camera.position});}finally{await page.keyboard.up('ArrowUp');}const after=await waitFresh(surface);assert([...(after.camera.position),...(after.camera.direction)].every(Number.isFinite));return{before:before.camera,after:after.camera,distance:Math.hypot(after.camera.position[0]-before.camera.position[0],after.camera.position[2]-before.camera.position[2])};};

  const entryURL=new URL('index.html?v=references29&view=forecourt&lighting=day',base).href,response=await page.goto(entryURL,{waitUntil:'load',timeout:120000});assert.equal(response.status(),200);
  await page.waitForFunction(()=>document.querySelector('#welcome-walk')?.disabled===false,{timeout:120000});assert.equal(await page.$eval('html',el=>el.dataset.release),String(version));await page.evaluate(installForecourtObserver);
  const sourceViews=await page.evaluate(async()=>{const v=await import(new URL('./district-views.js?v=references29',location.href).href),f=await import(new URL('./complex-footprints.js?v=references29',location.href).href),r=await import(new URL('./forecourt-reference-data.js?v=references29',location.href).href),w=await import(new URL('./forecourt-walking-layout.js?v=references29',location.href).href),g=await import(new URL('./forecourt-ground.js?v=references29',location.href).href);return{forecourt:v.forecourtView,district:v.districtView,referenceAspect:f.complexFootprints.views.referenceAspect,plaza:w.forecourtPlazaDestination,plazaGroundY:g.frontageGroundHeight(...w.forecourtPlazaDestination.point),roadsideCars:r.forecourtReference.roadside.cars.length,moduleURL:new URL('./district-views.js?v=references29',location.href).href};});
  assert(sourceViews.forecourt?.position?.length===3&&sourceViews.district?.target?.length===3);Object.assign(result,{expectedViews:sourceViews,referenceAspect:sourceViews.referenceAspect,plazaDestination:sourceViews.plaza,plazaGroundY:sourceViews.plazaGroundY,expectedRoadsideCars:sourceViews.roadsideCars,entryURL});
  await page.waitForFunction(()=>document.querySelector('#welcome-shot')?.textContent==='ПЛОЩАДЬ У ОФИСА / ПРОМЕНАД'&&document.querySelector('#welcome [data-time]')?.value==='12:00');
  const day=await waitCamera('welcome',sourceViews.forecourt);assertHouses(day);assertContext(day,true);assert.equal(day.forecourt.lighting.spill,0);await record('01-welcome-direct-forecourt-day',day);

  await uiClick('.welcome-district-button');const district=await waitCamera('welcome',sourceViews.district);assertHouses(district);assertContext(district,true);assert.equal(await page.$eval('#welcome-shot',el=>el.textContent),'РАЙОН / ОБЗОР');await record('02-existing-district-camera-still-works',district);
  await uiClick('.welcome-forecourt-button');const restoredPreset=await waitCamera('welcome',sourceViews.forecourt);assertForecourt(restoredPreset,true);await record('03-welcome-forecourt-button',restoredPreset);
  const welcomeNight=await setNight(welcomePanel,'welcome');assertNight(welcomeNight,day);assertContext(welcomeNight,true);await record('04-welcome-night-controls-light-real-inlays',welcomeNight);
  await panelOpen(welcomePanel,true);await uiClick('#welcome [data-context]');const welcomeOff=await waitFresh('welcome');assertContext(welcomeOff,false);await uiClick('#welcome [data-context]');const welcomeOn=await waitFresh('welcome');assertContext(welcomeOn,true);assert.deepEqual(welcomeOff.glErrors,[]);await panelOpen(welcomePanel,false);await record('05-welcome-context-off-and-restored',welcomeOn,{off:welcomeOff});

  await setDay(welcomePanel,'welcome');await page.setViewport({width:390,height:844,deviceScaleFactor:1});await uiClick('.welcome-forecourt-button');const mobileWelcome=await waitCamera('welcome',sourceViews.forecourt);assertHouses(mobileWelcome);assertContext(mobileWelcome,true);await record('06-mobile-390-welcome-forecourt',mobileWelcome);
  await uiClick('.welcome-walk-button');await clickPlaza('#welcome-3d');const welcomeWalk=await waitFresh('welcome');assertPlaza(welcomeWalk);const welcomeMovement=await stepForward('welcome');await record('07-mobile-welcome-walk-to-plaza',welcomeWalk,{movement:welcomeMovement});await uiClick('#welcome-3d .tour-exit');await waitCamera('welcome',sourceViews.forecourt);

  await page.setViewport({width:1500,height:1000,deviceScaleFactor:1});await uiClick('#welcome-skip');await uiClick('.map-entry');await mapReady();await uiClick('[data-cluster-camera="forecourt"]');await setDay(mapPanel,'map');
  const mapDay=await waitCamera('map',sourceViews.forecourt,true);assertHouses(mapDay);assertContext(mapDay,true);assert.equal(await page.$eval('.map-caption',el=>el.firstElementChild.textContent),'ПЛОЩАДЬ У ОФИСА');assert.equal(await page.$eval('.map-caption',el=>el.lastElementChild.textContent),'ПРОМЕНАД / КАФЕ');assert.equal(mapDay.forecourt.lighting.spill,0);await record('08-map-forecourt-button-day',mapDay);
  await setNight(mapPanel,'map');await panelOpen(mapPanel,true);await page.select(mapPanel+' [data-weather]','rain');await panelOpen(mapPanel,false);const mapNight=await waitFresh('map');assertNight(mapNight,mapDay);assert.equal(mapNight.forecourt.lighting.wetness,1);assert(mapNight.forecourt.lighting.cafeTerraceRoughness<mapDay.forecourt.lighting.cafeTerraceRoughness);assertContext(mapNight,true);await record('09-map-real-night-and-rain-controls',mapNight);
  await panelOpen(mapPanel,true);await uiClick(mapPanel+' [data-context]');const mapOff=await waitFresh('map');assertContext(mapOff,false);await uiClick(mapPanel+' [data-context]');const mapOn=await waitFresh('map');assertContext(mapOn,true);assert.deepEqual(mapOff.glErrors,[]);await panelOpen(mapPanel,false);await record('10-map-context-off-and-restored',mapOn,{off:mapOff});

  await setDay(mapPanel,'map');await page.setViewport({width:390,height:844,deviceScaleFactor:1});await uiClick('[data-cluster-camera="forecourt"]');const mobileMap=await waitCamera('map',sourceViews.forecourt,true);assertHouses(mobileMap);assertContext(mobileMap,true);assert.equal(mobileMap.forecourt.lighting.spill,0);assert.equal(mobileMap.forecourt.lighting.wetness,0);await record('11-mobile-390-map-forecourt-and-day-restoration',mobileMap);
  await uiClick('#cluster-walk');await clickPlaza('#cluster-map');const mapWalk=await waitFresh('map');assertPlaza(mapWalk);const mapMovement=await stepForward('map');await uiClick('#cluster-map .tour-exit');const mapWalkRestored=await waitCamera('map',sourceViews.forecourt,true);assert.equal(mapWalkRestored.tour.active,false);await record('12-mobile-map-plaza-walk-and-return',mapWalk,{movement:mapMovement,restored:mapWalkRestored});

  result.loadedRelevantModules=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/forecourt-|neighbor|neighborhood|district-views|geo-reference|transport-|traffic\.js|walking-tour/.test(n)));
  for(const file of['forecourt-architecture.js','forecourt-landscape.js','forecourt-cafes.js','forecourt-roadside.js','forecourt-ground.js','forecourt-walking-layout.js','district-views.js','neighbor-footprints-data.js'])assert(result.loadedRelevantModules.some(url=>url.includes(file+'?v=references29')),file+' loaded with release 29 cache query');
  assert.equal(result.steps.length,12);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.failedRequests.filter(r=>r.app),[]);assert.deepEqual(result.badResponses.filter(r=>r.app),[]);assert.equal(result.consoleErrors.some(e=>/THREE\.WebGLProgram|VALIDATE_STATUS|CONTEXT_LOST_WEBGL|GL_INVALID/i.test(e)),false);
  result.pass=true;result.status='PASS';result.finishedUtc=new Date().toISOString();save();console.log(JSON.stringify({status:'PASS',label,steps:result.steps.length,release:29,neighborRevision:28,houses:11,mobile:[390,844],imageExports:false,results:path.join(directory,'results.json')}));
 }catch(error){
  result.status='FAIL';result.failure=error.stack||String(error);result.finishedUtc=new Date().toISOString();
  if(page)result.domDiagnostic=await page.evaluate(()=>({url:location.href,release:document.documentElement.dataset.release,viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,shot:document.querySelector('#welcome-shot')?.textContent,heading:document.querySelector('#main h2')?.textContent,
   panels:[...document.querySelectorAll('details.env-panel')].map(p=>({parent:p.parentElement?.className,id:p.parentElement?.id,open:p.open})),welcomeFrame:window.__forecourtRead?.('welcome'),mapFrame:window.__forecourtRead?.('map'),activeTours:[...document.querySelectorAll('.tour-hud:not([hidden])')].map(h=>({parent:h.parentElement?.id,selected:h.querySelector('[aria-pressed="true"]')?.textContent,status:h.querySelector('.tour-status')?.textContent})),openDialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({id:d.id,className:d.className})),scroll:[scrollX,scrollY],
   overflowElements:[...document.querySelectorAll('body *')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&(r.right>innerWidth+1||r.left<-1);}).slice(0,16).map(el=>({tag:el.tagName,id:el.id,className:typeof el.className==='string'?el.className:'',left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))})).catch(e=>({error:e.message}));
  save();throw error;
 }finally{if(page)await page.evaluate(()=>window.__forecourtRestore?.()).catch(()=>{});await browser.close();}
}
module.exports={installForecourtObserver};
if(require.main===module)run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
