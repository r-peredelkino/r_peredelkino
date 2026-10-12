// Run only after the parent stages the completed v31 on the target Mac.
// CPU review (no browser / no GPU / no Puppeteer dependency):
//   node solar-shadow-gpu-native.cjs --review
// Native GPU:
//   node solar-shadow-gpu-native.cjs OUTPUT_LABEL HARNESS_URL [case1,case2]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const harnessPath=path.join(__dirname,'solar-shadow-gpu-harness.html');
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

async function cpuReview(){
  const assert=require('node:assert/strict'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
  const html=fs.readFileSync(harnessPath,'utf8');
  const module=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];assert.ok(module,'Module script missing');
  const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:module,encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr||'Harness module did not parse');
  const block=module.split('/* CPU_HELPERS_BEGIN */')[1]?.split('/* CPU_HELPERS_END */')[0];assert.ok(block,'Shared CPU helpers missing');
  const helpers=vm.runInNewContext(`${block}\nCPU_HELPERS;`,{}, {timeout:10000});
  const [THREE,solar,{geoFrame},shadow]=await Promise.all([
    import(pathToFileURL(path.resolve(__dirname,'../../dist/vendor/three.module.js'))),
    import(pathToFileURL(path.resolve(__dirname,'../../dist/solar.js'))),
    import(pathToFileURL(path.resolve(__dirname,'../../dist/geo-reference.js'))),
    import(pathToFileURL(path.resolve(__dirname,'../../dist/solar-shadow-camera.js'))),
  ]);
  const dates={user:solar.moscowDate('2026-10-11',432),summer:solar.daylight('2026-06-21',55.6367,37.3525).noonUTC,winter:solar.daylight('2026-12-21',55.6367,37.3525).noonUTC};
  const states=Object.fromEntries(Object.entries(dates).map(([key,date])=>[key,{...solar.solarPosition(date,55.6367,37.3525),dateUTC:new Date(date).toISOString()}]));
  states.low={azimuth:states.user.azimuth,apparentElevation:.25};
  const report={status:'CPU_REVIEW_PASS_GPU_PENDING',reviewedUTC:new Date().toISOString(),harnessSHA256:hash(Buffer.from(html)),
    scope:'Syntax, fixture orientation, camera mapping, independent analytic ray masks, GPU classifier sensitivity. No browser or GPU was launched.',fixtures:[]};
  const near=(a,b,tolerance,label)=>assert.ok(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);
  for(const config of helpers.QA_CASES.filter(c=>!c.control)){
    const plan=helpers.casePlan(config,states[config.sun],geoFrame),fixture=helpers.buildFixture(THREE,plan);
    const direction=solar.direction(plan.solar.azimuth,plan.solar.apparentElevation);
    near(Math.hypot(...plan.ray.map((n,i)=>n-direction[i])),0,1e-12,`${config.name}: independent geographic direction`);
    near(fixture.receiver.geometry.attributes.normal.getY(0),1,1e-6,`${config.name}: receiver faces up`);
    for(const [uFraction,vFraction] of [[.12,.78],[.7,.3],[.5,.5]]){
      const p=new THREE.Vector3(...helpers.worldPoint(plan,plan.uMin+plan.viewWidth*uFraction,plan.vMin+plan.viewHeight*vFraction));
      p.project(fixture.camera);near(p.x,uFraction*2-1,1e-9,'camera U');near(p.y,vFraction*2-1,1e-9,'camera V');
    }
    let rayComparisons=0,facetedCylinderDifferences=0;
    const raycaster=new THREE.Raycaster();raycaster.ray.direction.set(...plan.ray);
    for(let j=0;j<33;j++)for(let i=0;i<91;i++){
      const u=plan.uMin+(i+.37)/91*plan.viewWidth,v=plan.vMin+(j+.61)/33*plan.viewHeight;
      if(helpers.baseContains(plan,u,v))continue;
      raycaster.ray.origin.set(...helpers.worldPoint(plan,u,v,1e-8));
      const triangles=raycaster.intersectObject(fixture.caster,false).length>0,analytic=helpers.analyticBlocked(plan,u,v);
      if(triangles!==analytic){
        assert.equal(plan.shape,'cylinder',`${config.name}: analytic / actual box triangles differ at ${u},${v}`);
        const segmentU=Math.max(0,Math.min(plan.shadowLength,u)),distance=Math.hypot(u-segmentU,v);
        assert.ok(Math.abs(distance-plan.radius)<=plan.radius*(1-Math.cos(Math.PI/128))+1e-6,'Cylinder mismatch exceeds its documented chord approximation');facetedCylinderDifferences++;
      }
      rayComparisons++;
    }
    const light=new THREE.DirectionalLight();light.shadow.mapSize.set(4096,4096);
    const collected=shadow.collectSolarShadowBounds(fixture.root);
    const fitter=shadow.createSolarShadowCameraFitter(light,{casterBounds:collected.casterBounds,receiverBounds:fixture.receiverBounds});
    const fit=fitter.fit({camera:fixture.camera,direction:plan.ray,receiverBounds:fixture.receiverBounds});
    const [width,height]=plan.pixels,pixels=width*height,clear=new Uint8Array(pixels*4),ideal=new Uint8Array(pixels*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,u=plan.uMin+(x+.5)*plan.pixelWorld[0],v=plan.vMin+(y+.5)*plan.pixelWorld[1];
      const shaded=helpers.analyticBlocked(plan,u,v);clear.set([90,90,90,255],i);ideal.set(shaded?[0,0,0,255]:[90,90,90,255],i);
    }
    const positive=helpers.analysePixels(plan,fit,ideal,clear);
    assert.equal(positive.footprintPass,true,`${config.name}: ideal synthetic footprint rejected: ${JSON.stringify(positive.gates)}`);
    const missing=helpers.analysePixels(plan,fit,clear,clear);
    assert.equal(missing.footprintPass,false,`${config.name}: missing shadow was not detected`);
    const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(fixture.camera.projectionMatrix,fixture.camera.matrixWorldInverse));
    const casterInView=frustum.intersectsObject(fixture.caster);if(config.requiresOffView)assert.equal(casterInView,false);
    report.fixtures.push({name:config.name,height:plan.height,apparentElevation:plan.solar.apparentElevation,analyticShadowLength:plan.shadowLength,
      pixels:plan.pixels,pixelWorld:plan.pixelWorld,boundaryToleranceWorld:positive.resolution.boundaryToleranceWorld,
      strictShadowPixels:positive.metrics.strictShadowPixels,casterInView,lightNear:fit.near,lightFar:fit.far,
      rayComparisons,facetedCylinderDifferences,idealMaskAccepted:true,missingShadowRejected:true});
    fixture.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
  report.geometryRayComparisons=report.fixtures.reduce((sum,c)=>sum+c.rayComparisons,0);
  report.nativeGPUStatus='PENDING: parent must stage and run the native driver; this review is not a GPU pass';
  fs.writeFileSync(path.join(__dirname,'solar-shadow-gpu-review.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,fixtures:report.fixtures.length,geometryRayComparisons:report.geometryRayComparisons,harnessSHA256:report.harnessSHA256}));
}

async function nativeGPU(){
  const label=process.argv[2]||'solar-shadow-gpu-native',url=process.argv[3],filter=process.argv[4]?.split(',');
  if(!url)throw new Error('Pass OUTPUT_LABEL and the staged solar-shadow-gpu-harness.html URL (append ?dist=./ when it is in dist/)');
  if(!/^[a-zA-Z0-9_-]+$/.test(label))throw new Error('Use a plain output label');
  const puppeteer=require(process.env.RODINA_PUPPETEER_PATH||'/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
  const output=path.join(__dirname,label);fs.mkdirSync(output,{recursive:true});
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.RODINA_CHROME_PATH||'/tmp/rodina-reference-qa-v26/chrome-arm64',
    userDataDir:path.join(output,'chrome-profile'),args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run']});
  const errors=[],report={scope:'Native WebGL calibration of actual v31 architectural lighting and shadow fitter; not app FPS or measured building accuracy',url,startedUTC:new Date().toISOString(),errors,cases:[]};
  const write=()=>fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(report,null,2)+'\n');
  try{
    const page=await browser.newPage();page.setDefaultTimeout(120000);await page.setCacheEnabled(false);
    page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.setViewport({width:2100,height:1200,deviceScaleFactor:1});
    await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>window.qa?.ready||window.qa?.error);
    const ready=await page.evaluate(()=>({error:window.qa.error,rendererInfo:window.qa.rendererInfo,sourceHashes:window.qa.sourceHashes,cases:window.qa.cases}));
    if(ready.error)throw new Error(ready.error);
    report.rendererInfo=ready.rendererInfo;report.sourceHashes=ready.sourceHashes;
    report.softwareRendererDetected=/swiftshader|llvmpipe|softpipe|software/i.test(ready.rendererInfo.renderer);
    report.hardwareRendererEvidence=/apple|nvidia|amd|intel|adreno|mali|geforce|radeon/i.test(ready.rendererInfo.renderer)&&!report.softwareRendererDetected;
    const cases=ready.cases.filter(c=>!filter||filter.includes(c.name));if(!cases.length)throw new Error('No matching cases');
    for(const config of cases){
      const result=await page.evaluate(name=>window.qa.runCase(name),config.name),artifacts={};
      for(const [kind,png] of Object.entries(result.images)){
        const filename=`${config.name}-${kind}.png`;fs.writeFileSync(path.join(output,filename),Buffer.from(png.split(',')[1],'base64'));artifacts[kind]=filename;
      }
      delete result.images;result.artifacts=artifacts;report.cases.push(result);write();
      console.log(JSON.stringify({name:result.name,status:result.status,pass:result.pass,interiorMismatch:result.metrics.interiorMismatchFraction,
        contactGap:result.profile.contactGapWorld,tipError:result.profile.tipErrorWorld,tolerance:result.resolution.boundaryToleranceWorld,glError:result.glError}));
    }
    report.completedUTC=new Date().toISOString();report.pass=report.hardwareRendererEvidence&&errors.length===0&&report.cases.every(c=>c.pass);
    report.status=report.pass?'PASS':report.softwareRendererDetected?'FAIL_SOFTWARE_RENDERER':'FAIL';write();
    console.log(JSON.stringify({status:report.status,pass:report.pass,cases:report.cases.length,hardwareRendererEvidence:report.hardwareRendererEvidence,errors,output}));
    if(!report.pass)process.exitCode=1;
  }catch(error){report.status='ERROR';report.pass=false;report.error=String(error.stack||error);write();throw error;}
  finally{await browser.close();}
}

(process.argv[2]==='--review'?cpuReview():nativeGPU()).catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
