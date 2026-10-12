// Native Apple Silicon UI acceptance. Only QA outputs/profile live under /tmp.
// Uses real keyboard events and real game timers; does not replace model state.
const fs = require('node:fs');
const puppeteer = require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base = process.env.RP_QA_URL || 'http://127.0.0.1:8098/r_peredelkino';
const out = process.env.RP_QA_OUT || '/tmp/rodina-qa-publication';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const host = '#cluster-map';
const game = 'dialog.courtyard-activity[open]';
const room = 'dialog.rp-showroom[open]';
const pointerOnly=process.env.RP_QA_POINTER_ONLY==='1';
// Independent official-download evidence, frozen before product gallery integration.
const officialAmenityImageSha256 = {
  "assets/reference-amenities-v36/garden.webp": "a173dc3c3681d1bc79244b8528453e274398ae63ced3ba0acd3f684475f54d1c",
  "assets/reference-amenities-v36/1_lobby.webp": "616f3e935e6266b174a43c648af37b44d081fcac3a46d49436a8ff374a177f83",
  "assets/reference-amenities-v36/3_lobby.webp": "f9261fe9f86fd9a22277d5a661450126f38ae80b119fdbc71c81d508489de38e",
  "assets/reference-amenities-v36/4_lobby.webp": "38a9490a7151e755e6b03c463fe029832c3a7577a272aed276c334af8b5b7a5f",
  "assets/reference-amenities-v36/5_lobby.webp": "3697305916a0ea77a66feae4016dc52e104e8920ea6daf6bc4e1c9cfcc0ff6c8",
  "assets/reference-amenities-v36/8_lobby.jpg": "3ef156010dc9a4a47d6285864698d88c820629cef0a24f01f7d8bafab287d715",
  "assets/reference-amenities-v36/10_lobby.webp": "c2e12a22089bf7419b50c26d3f549bd8c0182410088c6c6ada15e4d29251aefa",
  "assets/reference-amenities-v36/11_kolysochnaya.webp": "170c45a5f95758d0a1c232a96ed6187a57d64668948423b97bc9915a4675c763",
  "assets/reference-amenities-v36/KIDS.jpg": "fc7c4b4a3265c3eb5c490ecccc964245b092b43ef5b1be3c212fc6dc2b077498",
  "assets/reference-amenities-v36/KITCHEN_9.jpg": "be1f7894b8af420121262aa0f1d0b9a7f12148746c0706e098eae01c49d009d7",
  "assets/reference-amenities-v36/LOUNGE_FIN_3.jpg": "7336ec0c4b34b6e9311d9bb2b4dd4430f69b18ea0fcef58228f302ea2726a100",
  "assets/reference-amenities-v36/YOGA_FIN.jpg": "3796f1ccffe786dc5323fd3161ee286eafa95ff3b677ff6c5d3c6fe355ab16c2",
  "assets/reference-amenities-v36/01.webp": "12d498836a36315fbd763b5367d2be8fd6ad8c44b92f930541977fe255dc337f",
  "assets/reference-amenities-v36/02.webp": "8c921c7ea68da293795b13f8620fe69e32e911ae74c3bccb7e8bb3331f5fb2fc",
  "assets/reference-amenities-v36/06.webp": "c71b85d2e3dec35a1aee35300977a2cf756be6462241f5adc6d86004613b6593",
  "assets/reference-amenities-v36/07.webp": "44e8045a5fd729b307806ec5ab2b15bc481fa33dbe666c28976b74a3fd6ce943",
  "assets/reference-amenities-v36/09.webp": "60a7672d06e868de8c6407c79e0e4ab84246df75d31bf2a383720961f41aa761",
  "assets/reference-amenities-v36/10.webp": "100296977eab634afc18895529d0cb0348b25150cf617c8c5819994eefd9620b",
  "assets/reference-amenities-v36/12.webp": "b8049505d3a928f8d460967a657377ccd8add58ca9182b208ca2d1ccde54a059",
  "assets/reference-amenities-v36/13.webp": "3a390230889a718d0b4956fe450b45c80f7c1a251bd5726e11816137ddd71cf4"
};

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/rodina-reference-qa-v26/chrome-arm64',
    userDataDir: out + '/interaction-browser',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update']
  });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.setDefaultTimeout(60000);
  // Enable touch from the initial navigation: changing hasTouch midway would
  // reload Chrome and discard the exact exterior continuation being tested.
  await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1, hasTouch: true});
  const errors = [], bad = [], checks = [];
  let apartmentExpectedChecks=0;
  page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400)
      bad.push({url: response.url(), status: response.status()});
  });
  const check = (name, result) => {
    checks.push({name, ...result});
    console.log(JSON.stringify(checks.at(-1)));
    if (!result.pass) throw new Error(name);
  };
  const pose = () => page.evaluate(() => ({
    position: window.__rp.camera.position.toArray(),
    quaternion: window.__rp.camera.quaternion.toArray(),
    fov: window.__rp.camera.fov,
    originalArea: document.querySelector('#cluster-map .tour-original').dataset.openOriginal,
    capture: (() => {const s = document.querySelector('#cluster-map').tourAPI.capture();
      return s ? {position: s.position, yaw: s.yaw, pitch: s.pitch, elevation: s.elevation, currentPlace: s.currentPlace} : null;})()
  }));
  const comparePose = async (name, prior) => check(name, await page.evaluate(before => {
    const camera = window.__rp.camera;
    const position = camera.position.toArray(), quaternion = camera.quaternion.toArray();
    const positionError = Math.hypot(...position.map((v, i) => v - before.position[i]));
    // q and -q represent the same rotation.
    const rotationError = Math.min(Math.hypot(...quaternion.map((v, i) => v - before.quaternion[i])),
      Math.hypot(...quaternion.map((v, i) => v + before.quaternion[i])));
    const originalArea = document.querySelector('#cluster-map .tour-original').dataset.openOriginal;
    return {pass: positionError < 1e-5 && rotationError < 1e-5 && camera.fov === before.fov && originalArea === before.originalArea,
      positionError, rotationError, originalArea, expectedOriginalArea: before.originalArea,
      before: before.position, after: position};
  }, prior));
  async function approach(id) {
    const moved = await page.evaluate(id => document.querySelector('#cluster-map').tourAPI.goToInteraction(id), id);
    if (!moved) throw new Error('No safe interaction approach: ' + id);
    await sleep(180);
    await page.evaluate(() => document.activeElement?.blur());
  }
  async function openDoor(id, kind, building = null) {
    await approach(id);
    const before = await pose();
    await page.keyboard.press('KeyE');
    await page.waitForFunction((kind, building) => {
      const dialog = document.querySelector('.rp-showroom');
      return dialog?.open && dialog.dataset.kind === kind && dialog.userData?.renderer &&
        (building === null || dialog.dataset.building === String(building));
    }, {}, kind, building);
    await sleep(150);
    check(id + ' opens via E into a safe walkable room', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), u = d.userData;
      return {pass: d.dataset.walking === 'true' && u.world.free(u.walker.x, u.walker.z) &&
        u.renderer.getContext().getError() === 0,
      kind: d.dataset.kind, building: d.dataset.building, walker: u.walker, height: u.height};
    }));
    return before;
  }
  async function closeDoor(before, id) {
    if(id==='lobby-1')await page.evaluate(()=>{
      const geometries=new Set(),textures=new Set(),records=[];
      document.querySelector('.rp-showroom').userData.scene.traverse(o=>{
        if(o.isMesh&&o.geometry)geometries.add(o.geometry);
        for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])
          for(const slot of ['map','bumpMap','roughnessMap','normalMap','alphaMap','emissiveMap'])if(material[slot])textures.add(material[slot]);
      });
      for(const [kind,objects]of [['geometry',geometries],['texture',textures]])for(const object of objects){const record={kind,name:object.name||object.type||object.uuid,disposals:0};object.addEventListener('dispose',()=>record.disposals++);records.push(record);}
      window.__lobbyResourceDisposals=records;
    });
    await page.click(room + ' [data-close]');
    await page.waitForFunction(() => !document.querySelector('.rp-showroom'));
    await sleep(180);
    await comparePose(id + ' close restores exterior position and rotation', before);
    if(id==='lobby-1')check('Closing the reconstructed lobby disposes every observed local geometry and texture exactly once',await page.evaluate(()=>{
      const r=window.__lobbyResourceDisposals,g=r.filter(v=>v.kind==='geometry'),t=r.filter(v=>v.kind==='texture'),bad=r.filter(v=>v.disposals!==1);
      return{pass:g.length>20&&t.length>5&&bad.length===0,geometries:g.length,textures:t.length,bad};
    }));
  }
  async function openActivity(id, mode) {
    await approach(id);
    await page.keyboard.press('KeyE');
    await page.waitForSelector(game);
    check(mode + ' opens from its physical courtyard object', await page.evaluate(mode => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      return {pass: tour.activities.enabled && tour.activities.state.mode === mode &&
        document.querySelector('dialog.courtyard-activity[open]').dataset.game === mode,
      state: tour.activities.state};
    }, mode));
  }

  async function selectAmenity(id) {
    await page.select(room + ' [data-room-spot]', id);
    await page.waitForFunction(id => {
      const d = document.querySelector('.rp-showroom'), u = d?.userData;
      const p = u?.pois.find(p => p.id === id);
      return p && d.dataset.walking === 'true' && u.world.free(u.walker.x, u.walker.z) &&
        Math.hypot(u.walker.x - p.x, u.walker.z - p.z) < 3.01 && !d.querySelector('.rp-room-guide').hidden;
    }, {polling:'raf'}, id);
  }
  async function clickAmenity(action, value) {
    const selector = room + ' [data-amenity-action="' + action + '"][data-amenity-value="' + value + '"]';
    await page.waitForSelector(selector); await page.click(selector);
  }
  async function exerciseClub() {
    check('Render-guided resident rooms are a declared first-floor concept', await page.evaluate(() => {
      const d=document.querySelector('.rp-showroom'), a=d.userData.amenities, m=a.club.metadata;
      return {pass: a.residentLobby.metadata.adaptedFloor===1 && m.floor===1 && m.authoredConcept &&
        !m.metricDeveloperPlan && m.trainingMachines===0 && m.trainingMats===6 && m.kidsEntryRule==='coffee-only' &&
        m.sourceRenderNames.length===4 && m.climbingHolds===40 && m.coffeeStools===3,
        residentFloor:a.residentLobby.metadata.adaptedFloor,clubMetadata:m};
    }));
    check('The actual corridor blocks a direct kids entrance while coffee connects to the playroom', await page.evaluate(async () => {
      const {residentLayout:l}=await import('./resident-layout-v36.js?v=publication371'), u=document.querySelector('.rp-showroom').userData;
      const direct=u.world.move({x:0,z:-11.5},-4,0),coffeeDoor=l.doors.find(d=>d.id==='door-coffee'),kidsDoors=l.doors.filter(d=>d.rooms.includes('kids')),kidsDoor=kidsDoors[0];
      // Enter through the actual coffee doorway, then turn into the free aisle
      // south of the bar/stools before crossing the coffee-to-kids doorway.
      const furniture=u.amenities.club.obstacles.filter(o=>o.zone==='coffee'),furnitureMinZ=Math.min(...furniture.map(o=>o.z-(o.type==='circle'?o.radius:o.depth/2))),aisleZ=(l.zones.coffee.zmin+furnitureMinZ)/2;
      const targets=[[coffeeDoor.coordinate-1,coffeeDoor.centre],[coffeeDoor.coordinate-1,aisleZ],[kidsDoor.centre,aisleZ],[kidsDoor.centre,kidsDoor.coordinate-1.4]],steps=[];
      let current={x:0,z:coffeeDoor.centre};const startFree=u.world.free(current.x,current.z);
      for(const [x,z]of targets){const before={...current},after=u.world.move(current,x-current.x,z-current.z),error=Math.hypot(after.x-x,after.z-z);steps.push({before,target:[x,z],after,error,free:u.world.free(after.x,after.z)});current=after;}
      return {pass:direct.x>l.zones.corridor.xmin&&kidsDoors.length===1&&kidsDoor.rooms.includes('coffee')&&startFree&&furniture.length>0&&steps.length===4&&steps.every(s=>s.error<.01&&s.free&&!s.after.blocked),
        direct,coffeeDoor,kidsDoors,aisleZ,furnitureMinZ,steps};
    }));
    await page.select(room+' [data-resident-room]','lobby');await page.select(room+' [data-resident-room]','kids');
    await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.activeRoom==='coffee',{polling:'raf'});
    check('Selecting the kids room from the lobby first brings the walker into parental coffee coworking',await page.evaluate(async()=>{const {insideRing}=await import('./walk-physics.js?v=publication371'),u=document.querySelector('.rp-showroom').userData,a=u.amenities;return{pass:a.activeRoom==='coffee'&&insideRing(u.walker.x,u.walker.z,a.residentLobby.layout.zones.coffee.outer)&&u.world.free(u.walker.x,u.walker.z),activeRoom:a.activeRoom,walker:u.walker};}));
    await page.select(room+' [data-resident-room]','kids');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.activeRoom==='kids',{polling:'raf'});
    check('The kids room becomes directly accessible from its connected coffee room',await page.evaluate(async()=>{const {insideRing}=await import('./walk-physics.js?v=publication371'),u=document.querySelector('.rp-showroom').userData,a=u.amenities;return{pass:a.activeRoom==='kids'&&insideRing(u.walker.x,u.walker.z,a.residentLobby.layout.zones.kids.outer)&&u.world.free(u.walker.x,u.walker.z),activeRoom:a.activeRoom,walker:u.walker};}));
    for(const id of ['resident-yoga','resident-kids','resident-coffee','resident-lounge-light','resident-lounge-seat']){
      await selectAmenity(id);check(id+' has a real safe walkable approach',await page.evaluate(id=>{const d=document.querySelector('.rp-showroom'),u=d.userData,p=u.pois.find(p=>p.id===id),distance=Math.hypot(u.walker.x-p.x,u.walker.z-p.z);return{pass:d.dataset.walking==='true'&&u.world.free(u.walker.x,u.walker.z)&&distance<3.01,walker:u.walker,point:[p.x,p.z],distance};},id));
    }
    await selectAmenity('resident-yoga');
    await page.evaluate(()=>{const v=document.querySelector('.rp-showroom').userData.scene.getObjectByName('Guided three-phase yoga floor-light pulses');window.__yogaIntensity=v.material.emissiveIntensity;window.__yogaMatrix=[...v.instanceMatrix.array];});
    await clickAmenity('amenity-yoga','start');
    await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Guided three-phase yoga floor-light pulses');return u.amenities.club.states.yoga.running&&Math.abs(v.material.emissiveIntensity-window.__yogaIntensity)>.04;},{timeout:6000,polling:'raf'});
    check('Training control changes the actual breathing fixtures and matrices',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Guided three-phase yoga floor-light pulses'),state=u.amenities.club.states.yoga;return{pass:state.running&&state.elapsed>0&&v.count===6&&Math.abs(v.material.emissiveIntensity-window.__yogaIntensity)>.04&&v.instanceMatrix.array.some((n,i)=>Math.abs(n-window.__yogaMatrix[i])>1e-4),state,intensity:v.material.emissiveIntensity};}));
    await clickAmenity('amenity-yoga','stop');
    check('Stopping the training demonstration restores its quiet light',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Guided three-phase yoga floor-light pulses');return{pass:!u.amenities.club.states.yoga.running&&Math.abs(v.material.emissiveIntensity-.08)<1e-8,state:u.amenities.club.states.yoga};}));
    await selectAmenity('resident-kids');await clickAmenity('amenity-kids','start');
    await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.club.states.kids;return s.mode==='preview'&&s.activeTile>=0&&u.scene.getObjectByName('Memory game colour tile '+s.activeTile).material.emissiveIntensity>.9;},{timeout:5000,polling:'raf'});
    check('Memory game previews its actual illuminated colour tiles',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.club.states.kids,v=u.scene.getObjectByName('Memory game colour tile '+s.activeTile);return{pass:s.mode==='preview'&&v.material.emissiveIntensity>.9&&v.position.y>.76,state:s,intensity:v.material.emissiveIntensity};}));
    await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.club.states.kids.mode==='input',{timeout:7000,polling:'raf'});
    const sequence=await page.evaluate(()=>[...document.querySelector('.rp-showroom').userData.amenities.club.states.kids.sequence]);
    for(const n of sequence)await clickAmenity('amenity-kids',String(n));
    await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData;return u.amenities.club.states.kids.mode==='complete'&&Array.from({length:4},(_,i)=>u.scene.getObjectByName('Memory game colour tile '+i)).every(v=>v.material.emissiveIntensity>.9);},{polling:'raf'});
    check('Four real tile selections complete the resident game and illuminate all four tiles',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.club.states.kids,tiles=Array.from({length:4},(_,i)=>u.scene.getObjectByName('Memory game colour tile '+i));return{pass:s.mode==='complete'&&s.score===4&&s.index===4&&tiles.every(v=>v.material.emissiveIntensity>.9),state:s,intensities:tiles.map(v=>v.material.emissiveIntensity)};}));
    await selectAmenity('resident-coffee');
    const drinks=[];
    for(const value of ['espresso','latte','tea']){
      await clickAmenity('amenity-coffee',value);
      await page.waitForFunction(value=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.club.states.coffee,v=u.scene.getObjectByName('Nine animated coffee steam curls');return s.beverage===value&&s.brewing&&s.elapsed>.1&&v.visible;},{timeout:5000,polling:'raf'},value);
      const before=await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,steam=u.scene.getObjectByName('Nine animated coffee steam curls');return{elapsed:u.amenities.club.states.coffee.elapsed,matrix:[...steam.instanceMatrix.array]};});
      await page.waitForFunction(elapsed=>document.querySelector('.rp-showroom').userData.amenities.club.states.coffee.elapsed>elapsed+.1,{timeout:5000,polling:'raf'},before.elapsed);
      drinks.push(await page.evaluate(before=>{const u=document.querySelector('.rp-showroom').userData,steam=u.scene.getObjectByName('Nine animated coffee steam curls'),liquid=u.scene.getObjectByName('Actual selected beverage surface'),matrix=[...steam.instanceMatrix.array];return{beverage:u.amenities.club.states.coffee.beverage,colour:liquid.material.color.getHex(),steamCount:steam.count,matrix,visible:steam.visible,elapsed:u.amenities.club.states.coffee.elapsed,previousElapsed:before.elapsed,actualMatrixChanged:matrix.some((n,i)=>Math.abs(n-before.matrix[i])>1e-6)};},before));
    }
    check('Coffee selections change the actual liquid and animate nine local steam curls',{pass:new Set(drinks.map(d=>d.colour)).size===3&&drinks.every(d=>d.visible&&d.steamCount===9&&d.matrix.every(Number.isFinite)&&d.actualMatrixChanged&&d.elapsed>d.previousElapsed+.1),drinks});
    await clickAmenity('amenity-coffee','stop');check('Stopping the beverage demonstration removes its actual steam',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{pass:!u.amenities.club.states.coffee.brewing&&!u.scene.getObjectByName('Nine animated coffee steam curls').visible};}));
    await selectAmenity('resident-lounge-light');
    await clickAmenity('amenity-light','quiet');const quiet=await page.evaluate(()=>document.querySelector('.rp-showroom').userData.scene.getObjectByName('Three warm vertical lounge light fixtures').material.emissiveIntensity);
    await clickAmenity('amenity-light','warm');const warm=await page.evaluate(()=>document.querySelector('.rp-showroom').userData.scene.getObjectByName('Three warm vertical lounge light fixtures').material.emissiveIntensity);
    check('Lounge lighting changes the actual three luminous fixtures',{pass:Math.abs(quiet-.20)<1e-8&&Math.abs(warm-.85)<1e-8&&warm>quiet,quiet,warm});
    await selectAmenity('resident-lounge-seat');const loungeStanding=await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{walker:{...u.walker},position:u.camera.position.toArray(),quaternion:u.camera.quaternion.toArray()};});await clickAmenity('amenity-seat','sit');
    await page.waitForFunction(()=>document.querySelector('.rp-showroom').dataset.walking==='false',{polling:'raf'});
    check('Lounge seating provides an actual seated human-eye view',await page.evaluate(()=>{const d=document.querySelector('.rp-showroom'),u=d.userData;return{pass:d.dataset.walking==='false'&&Math.abs(u.camera.position.y-1.31)<.005,camera:u.camera.position.toArray()};}));
    await page.click(room+' [data-seat-return]');await page.waitForFunction(()=>document.querySelector('.rp-showroom').dataset.walking==='true',{polling:'raf'});
    check('Standing from the lounge restores the exact safe walker, direction and club state',await page.evaluate(before=>{const d=document.querySelector('.rp-showroom'),u=d.userData,p=u.camera.position.toArray(),q=u.camera.quaternion.toArray();return{pass:d.dataset.walking==='true'&&u.world.free(u.walker.x,u.walker.z)&&!u.amenities.club.states.lounge.seated&&Math.hypot(...p.map((v,i)=>v-before.position[i]))<1e-5&&Math.hypot(...q.map((v,i)=>v-before.quaternion[i]))<1e-5,before,after:{walker:u.walker,position:p,quaternion:q}};},loungeStanding));
  }

  async function exerciseParking(building) {
    await page.waitForFunction(()=>document.querySelector('.rp-showroom')?.dataset.kind==='parking'&&document.querySelector('.rp-showroom')?.userData?.amenities?.parking);
    check('Parking exposes a truthful local −1 section and preserves the caller section',await page.evaluate(building=>{
      const d=document.querySelector('.rp-showroom'),u=d.userData,m=u.amenities.parking.metadata;
      return{pass:d.dataset.building===String(building)&&m.mainBuilding===building&&m.level===-1&&!m.exteriorRegistration&&
        m.documentedServices.storageLevel===-1&&m.documentedServices.possibilityOfEVChargerInstallation&&m.section.notComplexCapacity&&
        Object.values(m.unknown).every(v=>v===null)&&m.section.illustrativeBayCount===m.bays.length&&
        d.dataset.walking==='true'&&u.world.free(u.walker.x,u.walker.z)&&Math.abs(u.height)<1e-9,
        building:d.dataset.building,metadata:m};
    },building));
    await selectAmenity('parking-barrier');await clickAmenity('parking-demo','barrier');
    await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Parking demo barrier arm pivot');return v.rotation.z>1.3&&u.world.obstacles.find(o=>o.id==='barrier-arm').enabled===false;},{timeout:7000,polling:'raf'});
    check('Parking demo raises its real barrier and disables only its own arm collider',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.parking.states,v=u.scene.getObjectByName('Parking demo barrier arm pivot'),ob=u.world.obstacles.find(o=>o.id==='barrier-arm');return{pass:s.barrier&&v.rotation.z>1.3&&ob.enabled===false,angle:v.rotation.z,state:s,colliderEnabled:ob.enabled};}));
    await clickAmenity('parking-demo','barrier');await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData;return u.scene.getObjectByName('Parking demo barrier arm pivot').rotation.z<.03&&u.world.obstacles.find(o=>o.id==='barrier-arm').enabled===true;},{timeout:7000,polling:'raf'});
    check('Closing the parking barrier restores its physical angle and collision',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{pass:!u.amenities.parking.states.barrier&&u.scene.getObjectByName('Parking demo barrier arm pivot').rotation.z<.03&&u.world.obstacles.find(o=>o.id==='barrier-arm').enabled===true};}));
    await selectAmenity('parking-ev');await clickAmenity('parking-demo','charging');
    await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData;return u.amenities.parking.states.charging&&u.scene.getObjectByName('Parking local charging progress bar').scale.x>.035;},{timeout:7000,polling:'raf'});
    check('Local EV demonstration advances the actual charge bar without asserting installed chargers',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,a=u.amenities.parking,m=a.metadata,bar=u.scene.getObjectByName('Parking local charging progress bar'),indicator=u.scene.getObjectByName('Parking EV charging status indicator');return{pass:a.states.charging&&a.states.chargingSeconds>0&&bar.scale.x>.035&&Number.isFinite(indicator.scale.y)&&indicator.scale.y>=.699&&indicator.scale.y<=1.001&&m.unknown.installedChargers===null,state:a.states,progressScale:bar.scale.x,indicatorScale:indicator.scale.y};}));
    await clickAmenity('parking-demo','charging');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.scene.getObjectByName('Parking local charging progress bar').scale.x===.025,{polling:'raf'});
    check('Stopping EV demonstration resets the actual meter',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{pass:!u.amenities.parking.states.charging&&u.scene.getObjectByName('Parking local charging progress bar').scale.x===.025};}));
    await selectAmenity('parking-storage');await clickAmenity('parking-demo','storage');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.scene.getObjectByName('Parking demo storage door hinge').rotation.y< -1.2,{timeout:7000,polling:'raf'});
    check('Storage door physically swings while its undisclosed interior remains a reserved solid',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,s=u.amenities.parking.states,v=u.scene.getObjectByName('Parking demo storage door hinge');return{pass:s.storage&&v.rotation.y< -1.2&&!u.world.free(-6,10.7),angle:v.rotation.y,storageInteriorFree:u.world.free(-6,10.7)};}));
    await clickAmenity('parking-demo','storage');
    await selectAmenity('parking-find-car');await clickAmenity('parking-demo','find-car');await page.waitForFunction(()=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Parking find-my-car animated blue trail');return v.visible&&v.instanceMatrix.array[12]< -5;},{polling:'raf'});
    const trailBefore=await page.evaluate(()=>[...document.querySelector('.rp-showroom').userData.scene.getObjectByName('Parking find-my-car animated blue trail').instanceMatrix.array]);await sleep(250);
    check('Find-car control animates real route instances and an illustrative bay beacon',await page.evaluate(before=>{const u=document.querySelector('.rp-showroom').userData,v=u.scene.getObjectByName('Parking find-my-car animated blue trail'),beacon=u.scene.getObjectByName('Parking illustrative bay111 location beacon');return{pass:u.amenities.parking.states['find-car']&&v.visible&&beacon.visible&&v.count>20&&v.instanceMatrix.array.some((n,i)=>Math.abs(n-before[i])>1e-4),segments:v.count,beaconVisible:beacon.visible};},trailBefore));
    await clickAmenity('parking-demo','find-car');
    check('Stopping wayfinding removes the actual trail and beacon',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{pass:!u.scene.getObjectByName('Parking find-my-car animated blue trail').visible&&!u.scene.getObjectByName('Parking illustrative bay111 location beacon').visible};}));
    await selectAmenity('parking-info');
    check('Parking info separates documented services from unknown capacity and ramp geometry',await page.evaluate(()=>{const d=document.querySelector('.rp-showroom'),text=d.querySelector('[data-guide-text]').textContent;return{pass:text.includes('не подтверждены')&&text.includes('−1')&&text.includes('велосипед'),text};}));
    await page.screenshot({path:out+'/parking-reviewed-ui.png'});
  }

  async function exerciseSourceGallery() {
    await page.click(room+' [data-source-gallery]');await page.waitForSelector('dialog.rp-source-gallery[open]');
    const gallery='dialog.rp-source-gallery[open]';
    await page.click(gallery+' [data-reference-filter=all]');
    const galleryRefs=await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return u.amenities.sourceGallery.records.map(r=>({path:r.path,sha256:r.sha256}));});
    const imageResults=[];
    for(const sourceRecord of galleryRefs){
      const asset={...sourceRecord,officialSha256:officialAmenityImageSha256[sourceRecord.path]};
      const result=await page.evaluate(async asset=>{
        const img=[...document.querySelectorAll('dialog.rp-source-gallery img[data-reference-image]')].find(i=>new URL(i.getAttribute('src'),location.href).pathname.endsWith('/'+asset.path));
        if(!img)return{path:asset.path,missing:true,pass:false};img.scrollIntoView({block:'center'});
        try{await img.decode();}catch(error){return{path:asset.path,error:String(error),pass:false};}
        const r=await fetch(asset.path,{cache:'no-store'}),bytes=await r.arrayBuffer(),sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
        return{path:asset.path,pass:r.ok&&img.complete&&img.naturalWidth>0&&img.naturalHeight>0&&sha256===asset.sha256&&sha256===asset.officialSha256,width:img.naturalWidth,height:img.naturalHeight,bytes:bytes.byteLength,sha256,expected:asset.officialSha256,runtimeRecord:asset.sha256};
      },asset);imageResults.push(result);
    }
    check('All twenty actual source-gallery images load, decode and match their official source bytes',{pass:galleryRefs.length===20&&new Set(galleryRefs.map(r=>r.path)).size===20&&imageResults.length===20&&imageResults.every(r=>r.pass),images:imageResults});
    check('Source gallery preserves developer attribution and the limits of reconstruction',await page.evaluate(()=>{
      const d=document.querySelector('dialog.rp-source-gallery'),text=d.textContent;
      return{pass:document.querySelectorAll('dialog.rp-source-gallery img[data-reference-image]').length===20&&text.includes('Родина')&&/рендер|визуализац/i.test(text)&&/авторская схема|размер|обмер|рабоч|точн/i.test(text),text:text.slice(0,1600)};
    }));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog.rp-source-gallery[open]'));
    check('Closing the nested source gallery keeps the current lobby and safe walker',await page.evaluate(()=>{const d=document.querySelector('.rp-showroom'),u=d.userData;return{pass:d.open&&d.dataset.kind==='lobby'&&d.dataset.walking==='true'&&u.world.free(u.walker.x,u.walker.z)};}));
  }
  async function exerciseLobby() {
    check('Lobby reconstructs the light wave as one real instanced fixture',await page.evaluate(()=>{
      const u=document.querySelector('.rp-showroom').userData,m=u.amenities.residentLobby.metadata,v=u.scene.getObjectByName('Resident wave light · 704 batched points'),ys=Array.from({length:v.count},(_,i)=>v.instanceMatrix.array[i*16+13]);
      return{pass:m.adaptedFloor===1&&!m.measuredPlan&&m.liftCabins===3&&m.guestWC&&m.bicycleStorage&&v.isInstancedMesh&&v.count===704&&Math.max(...ys)-Math.min(...ys)>.7&&ys.every(Number.isFinite),points:v.count,heightRange:Math.max(...ys)-Math.min(...ys),metadata:m};
    }));
    await selectAmenity('resident-lift');const closedLift=await page.evaluate(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.liftLeaves.map(p=>({x:p.leaf.position.x,side:p.side})));
    await clickAmenity('amenity-lift','toggle');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.states.lift.progress>.99,{timeout:7000,polling:'raf'});
    check('All six lift leaves physically open with synchronized collision boxes',await page.evaluate(before=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby;return{pass:a.states.lift.open&&a.liftLeaves.length===6&&a.liftLeaves.every((p,i)=>Math.abs(p.leaf.position.x-before[i].x)>.84&&Math.abs(p.collision.x-p.leaf.position.x)<1e-9),progress:a.states.lift.progress,positions:a.liftLeaves.map(p=>({mesh:p.leaf.position.x,collider:p.collision.x}))};},closedLift));
    await clickAmenity('amenity-lift','toggle');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.states.lift.progress<.01,{timeout:7000,polling:'raf'});
    check('Closing the lift restores its actual leaves and collision positions',await page.evaluate(before=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby;return{pass:!a.states.lift.open&&a.liftLeaves.every((p,i)=>Math.abs(p.leaf.position.x-before[i].x)<.01&&Math.abs(p.collision.x-p.leaf.position.x)<1e-9),progress:a.states.lift.progress};},closedLift));
    await selectAmenity('resident-entry');await clickAmenity('amenity-entry','toggle');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.states.entry.progress<.01,{timeout:7000,polling:'raf'});
    const closedEntry=await page.evaluate(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.entryLeaves.map(p=>p.leaf.position.x));
    check('The double entrance physically closes with matching leaf collision',await page.evaluate(()=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby;return{pass:!a.states.entry.open&&a.entryLeaves.length===2&&a.entryLeaves.every(p=>Math.abs(p.collision.x-p.leaf.position.x)<1e-9),progress:a.states.entry.progress};}));
    await clickAmenity('amenity-entry','toggle');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.states.entry.progress>.99,{timeout:7000,polling:'raf'});
    check('Both real entrance leaves slide open with their collisions',await page.evaluate(before=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby;return{pass:a.states.entry.open&&a.entryLeaves.every((p,i)=>Math.abs(p.leaf.position.x-before[i])>1.12&&Math.abs(p.collision.x-p.leaf.position.x)<1e-9),positions:a.entryLeaves.map(p=>p.leaf.position.x)};},closedEntry));
    for(const [id,type,stateId]of [['resident-handwash','hand','handwash'],['resident-pawwash','paw','pawwash']]){
      await selectAmenity(id);const before=await page.evaluate(stateId=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby,p=a.streams.find(p=>p.id===stateId);return p.texture.offset.y;},stateId);
      await clickAmenity('amenity-wash',type);await page.waitForFunction(stateId=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby,p=a.streams.find(p=>p.id===stateId);return a.states[stateId].running&&p.mesh.visible&&a.states[stateId].phase>.15;},{timeout:5000,polling:'raf'},stateId);
      check(type+' wash toggles an actual visible animated stream',await page.evaluate((stateId,before)=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby,p=a.streams.find(p=>p.id===stateId);return{pass:a.states[stateId].running&&p.mesh.visible&&Math.abs(p.texture.offset.y-before)>.1,phase:a.states[stateId].phase,offset:p.texture.offset.y};},stateId,before));
      await clickAmenity('amenity-wash',type);const stopped=await page.evaluate(stateId=>document.querySelector('.rp-showroom').userData.amenities.residentLobby.streams.find(p=>p.id===stateId).texture.offset.y,stateId);await sleep(200);
      check(type+' wash hides its stream and freezes its real flow texture',await page.evaluate((stateId,stopped)=>{const a=document.querySelector('.rp-showroom').userData.amenities.residentLobby,p=a.streams.find(p=>p.id===stateId);return{pass:!a.states[stateId].running&&!p.mesh.visible&&p.texture.offset.y===stopped,offset:p.texture.offset.y};},stateId,stopped));
    }
    await selectAmenity('resident-stroller');await clickAmenity('amenity-stroller','toggle');await page.waitForFunction(()=>document.querySelector('.rp-showroom').userData.scene.getObjectByName('Resident stroller locker hinge').rotation.y< -1.48,{timeout:7000,polling:'raf'});
    check('Stroller locker opens a real hinged leaf beside modeled storage',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData,a=u.amenities.residentLobby;return{pass:a.states.stroller.open&&a.metadata.strollers===2&&u.scene.getObjectByName('Resident stroller locker hinge').rotation.y< -1.48,angle:u.scene.getObjectByName('Resident stroller locker hinge').rotation.y};}));
    await clickAmenity('amenity-stroller','toggle');await page.waitForFunction(()=>Math.abs(document.querySelector('.rp-showroom').userData.scene.getObjectByName('Resident stroller locker hinge').rotation.y)<.01,{timeout:7000,polling:'raf'});
    check('Stroller locker closes its actual hinge',await page.evaluate(()=>{const u=document.querySelector('.rp-showroom').userData;return{pass:!u.amenities.residentLobby.states.stroller.open&&Math.abs(u.scene.getObjectByName('Resident stroller locker hinge').rotation.y)<.01};}));
  }

  async function exerciseApartmentHall(building) {
    await selectAmenity('resident-lift');await clickAmenity('amenity-route','apartment-hall');
    await page.waitForFunction(building=>{const d=document.querySelector('.rp-showroom');return d?.dataset.kind==='apartment-hall'&&d.dataset.building===String(building)&&d.userData?.amenities?.residentLobby;},{},building);
    check('Apartment hall retains section '+building+' and the original apartment plans',await page.evaluate(building=>{const d=document.querySelector('.rp-showroom'),u=d.userData,m=u.amenities.residentLobby.metadata;return{pass:d.dataset.building===String(building)&&m.kind==='apartment-hall'&&m.building===building&&m.originalApartmentPlansUnchanged&&d.dataset.walking==='true'&&u.world.free(u.walker.x,u.walker.z),building:m.building,metadata:m};},building));
    if(await page.$eval(room+' .rp-room-guide',e=>!e.hidden))await page.click(room+' [data-guide-close]');await page.evaluate(()=>document.activeElement?.blur());const from=await page.evaluate(()=>({...document.querySelector('.rp-showroom').userData.walker}));
    await page.keyboard.down('KeyW');await sleep(350);await page.keyboard.up('KeyW');
    check('Apartment hall '+building+' supports actual safe keyboard walking',await page.evaluate(before=>{const u=document.querySelector('.rp-showroom').userData;return{pass:u.world.free(u.walker.x,u.walker.z)&&Math.hypot(u.walker.x-before.x,u.walker.z-before.z)>.1,before,after:u.walker};},from));
    await selectAmenity('hall-lift');await clickAmenity('amenity-route','lobby');await page.waitForFunction(building=>{const d=document.querySelector('.rp-showroom');return d?.dataset.kind==='lobby'&&d.dataset.building===String(building)&&d.userData?.amenities?.club;},{},building);
    check('Apartment hall '+building+' lift returns to the same section without resuming outside early',await page.evaluate(building=>{const d=document.querySelector('.rp-showroom'),t=document.querySelector('#cluster-map').tourAPI;return{pass:d.dataset.kind==='lobby'&&d.dataset.building===String(building)&&d.dataset.walking==='true'&&!t.enabled&&t.hud.hidden,building:d.dataset.building};},building));
  }

  async function exerciseApartmentPointerAndLayout() {
    const select='#model-viewport [data-apt-interaction]',activate='#model-viewport [data-apt-action]',stand='#model-viewport [data-apt-stand]';
    const firstRest=await page.evaluate(()=>document.querySelector('#model-viewport').userData.actions.poi.find(p=>p.action==='apartment-pose').id);
    async function realSelect(view){
      const rect=await page.$eval(select,el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
      if(view==='Mobile')await page.touchscreen.tap(rect.x,rect.y);else await page.click(select);
      check(view+' apartment selector accepts an actual '+(view==='Mobile'?'touch':'pointer click')+' and receives focus',await page.evaluate(()=>{const el=document.querySelector('#model-viewport [data-apt-interaction]'),style=getComputedStyle(el),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{pass:document.documentElement.dataset.release==='37'&&document.activeElement===el&&style.pointerEvents!=='none'&&hit===el,pointerEvents:style.pointerEvents,focused:document.activeElement===el,hitTag:hit?.tagName,viewport:[innerWidth,innerHeight]};}));
      // Native Mac popup keyboard is not delivered reliably by headless CDP.
      // Pointer/touch reachability is proved above; HTML select change binding
      // and the subsequent real action click are proved without claiming an OS
      // popup keyboard result. Blur closes the browser's popup before setup.
      await page.evaluate(()=>document.querySelector('#model-viewport [data-apt-interaction]').blur());
      await page.select(select,firstRest);
      check(view+' apartment selection change updates its actual bed action control',await page.evaluate(id=>{const u=document.querySelector('#model-viewport').userData,el=document.querySelector('#model-viewport [data-apt-interaction]'),button=document.querySelector('#model-viewport [data-apt-action]'),item=u.actions.poi.find(p=>p.id===id);return{pass:el.value===id&&button.textContent===item.actionLabel&&!button.disabled&&item.type==='bed',value:el.value,expected:id,actionLabel:button.textContent};},firstRest));
    }
    async function fit(view){
      check(view+' apartment movement, exit and resting interaction controls fit the viewport',await page.evaluate(()=>{
        const d=document.querySelector('#model-viewport'),u=d.userData,selectors=['.apt-move','.apt-look','.apt-exit','[data-apt-interaction]','[data-apt-action]','[data-apt-stand]'],rects=selectors.map(selector=>{const el=d.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visible:!el.hidden&&s.display!=='none'&&s.visibility!=='hidden'};});
        return{pass:u.tour.resting&&u.actions.states.pose.mode==='lying'&&rects.every(r=>r.visible&&r.width>0&&r.height>0&&r.x>=-.1&&r.y>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1),viewport:[innerWidth,innerHeight],rects};
      }));
    }
    await realSelect('Desktop');await page.waitForFunction(s=>!document.querySelector(s).disabled,{polling:'raf'},activate);await page.click(activate);
    await page.waitForFunction(()=>{const u=document.querySelector('#model-viewport').userData;return u.tour.resting&&!u.tour.transitioning&&u.actions.states.pose.mode==='lying';},{polling:'raf'});await fit('Desktop');
    await page.setViewport({width:390,height:844,deviceScaleFactor:1,hasTouch:true});await sleep(180);await realSelect('Mobile');await fit('Mobile');
    await page.setViewport({width:1440,height:1000,deviceScaleFactor:1,hasTouch:true});await sleep(180);await page.click(stand);await page.waitForFunction(()=>{const u=document.querySelector('#model-viewport').userData;return !u.actions.states.pose.id&&!u.tour.transitioning;},{polling:'raf'});
  }

  async function exerciseApartmentCatalog() {
    // Enter every example through the public catalog, with genuine UI controls.
    // source trace, layout registration, interactive fixtures and safe camera
    // restoration are inspected independently of the actions state booleans.
    await page.evaluate(()=>document.querySelector('#cluster-map').tourAPI.exit());
    const catalogSelector='[data-plan-catalog]';
    await page.waitForSelector(catalogSelector);
    const catalog=await page.$$eval(catalogSelector+' option',els=>els.filter(e=>e.value&&!e.disabled).map(e=>({id:e.value,title:e.textContent})));
    const planExpectations=await page.evaluate(async()=>Object.entries((await import('./apartment-plans.js?v=publication371')).apartmentPlans).map(([id,p])=>({id,fixtures:p.furniture.filter(f=>['bed','sofa','lsofa','chair','toilet'].includes(f[0])).length})));
    const actualPlanIds=planExpectations.map(p=>p.id);
    apartmentExpectedChecks=6+(actualPlanIds.includes('1-81')?7:0)+planExpectations.reduce((sum,p)=>sum+11+(p.fixtures?2:0)+p.fixtures*3,0);
    check('The public 3D catalog exposes every reconstructed source plan and retains studio and family examples',{
      pass:catalog.length===actualPlanIds.length&&new Set(catalog.map(p=>p.id)).size===catalog.length&&actualPlanIds.every(id=>catalog.some(p=>p.id===id))&&['1-59','1-81'].every(id=>catalog.some(p=>p.id===id)),catalog,actualPlanIds});
    const exercisedTypes=new Set();
    for(const example of catalog){
      await page.select(catalogSelector,example.id);
      const exterior=await pose();
      await page.click('[data-open-plan]');
      await page.waitForFunction(id=>document.querySelector('#sheet')?.open&&document.querySelector('#model-viewport')?.userData?.apartment?.data&&document.querySelector('#model-viewport').userData.apartment.root.name.startsWith('Apartment '+id+' '),{timeout:90000,polling:'raf'},example.id);
      await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.renderer.info.render.triangles>0,{polling:'raf'});
      check(example.id+' renders its furnished source-traced model with glazing fitted to the unchanged tower',await page.evaluate(()=>{
        const u=document.querySelector('#model-viewport').userData,a=u.apartment,m=a.facadeRegistration.metadata,profile=a.facadeRegistration.profile,positions=a.glazing.geometry.attributes.position;let maxPaneGap=0,finite=true;for(let i=0;i<positions.count;i++){maxPaneGap=Math.max(maxPaneGap,a.facadeRegistration.nearest([positions.getX(i),positions.getZ(i)]).distance);finite=finite&&Number.isFinite(positions.getX(i)+positions.getY(i)+positions.getZ(i));}
        return{pass:u.renderer.getContext().getError()===0&&u.renderer.info.render.triangles>0&&a.withFurniture&&m.originalMetricPlanPreserved&&m.sourceTowerGeometryUnchanged&&m.maxAdaptedPaneGap<.015&&maxPaneGap<.015&&finite&&profile.sill>0&&profile.head<=a.data.ceilingHeight&&positions.count>0,
          registration:m,profile,maxPaneGap,actualPaneVertices:positions.count,triangles:u.renderer.info.render.triangles,windows:a.facadeRegistration.windows.length,furniture:a.data.furniture.length};
      }));
      check(example.id+' physically embeds three independently recoverable voxel author marks',await page.evaluate(async()=>{
        const {readVoxelAuthorship}=await import('./voxel-authorship-v37.js?v=publication371'),a=document.querySelector('#model-viewport').userData.apartment,records=a.voxelAuthorship.records,reads=records.map(r=>readVoxelAuthorship(r.mesh.geometry,r));
        return{pass:records.length===3&&new Set(records.map(r=>r.meshUuid)).size===3&&reads.every(r=>r.complete&&r.text==='@r_peredelkino'&&r.recoveredPixels===r.expectedPixels),carriers:records.length,reads};
      }));
      await page.click('#sheet [data-mode="2d"]');
      await page.waitForSelector('#model-source:not([hidden])');
      check(example.id+' preserves its readable original source plan',await page.evaluate(async()=>{
        const img=document.querySelector('#model-source img');await img.decode();
        return{pass:img.naturalWidth>=400&&img.naturalHeight>=300&&img.complete,source:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight};
      }));
      await page.click('#sheet [data-mode="3d"]');await page.click('#model-walk');
      await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.tour.enabled,{polling:'raf'});
      check(example.id+' has a free furnished first-person entry at human eye height',await page.evaluate(()=>{
        const u=document.querySelector('#model-viewport').userData,a=u.apartment,p=u.tour.position,local=a.root.worldToLocal(u.camera.position.clone());
        return{pass:u.tour.enabled&&a.world.free(p.x,p.z)&&Math.abs(local.y-1.68)<1e-6&&u.actions.metadata.allApproachesReachable&&u.actions.metadata.allRestPosesSafe,position:p,localEye:local.toArray(),actions:u.actions.metadata};
      }));
      const roomTargets=[];
      const roomCount=await page.evaluate(()=>document.querySelector('#model-viewport').userData.apartment.data.rooms.length);
      for(let i=0;i<roomCount;i++){
        await page.click('#model-viewport [data-apt-room="'+i+'"]');
        await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.tour.enabled,{polling:'raf'});
        roomTargets.push(await page.evaluate(async i=>{
          const {insideRing}=await import('./walk-physics.js?v=publication371'),u=document.querySelector('#model-viewport').userData,a=u.apartment,p=u.tour.position,r=a.data.rooms[i];
          return{room:r.name,pass:a.world.free(p.x,p.z)&&insideRing(p.x,p.z,r.p.map(q=>a.metrics.coord(...q))),position:p};
        },i));
      }
      check(example.id+' exposes a safe walkable viewpoint inside every source room',{pass:roomTargets.length===roomCount&&roomTargets.every(r=>r.pass),rooms:roomTargets});
      const select='#model-viewport [data-apt-interaction]',activate='#model-viewport [data-apt-action]',stand='#model-viewport [data-apt-stand]';
      if(example.id==='1-81'){
        await exerciseApartmentPointerAndLayout();
        await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.down('KeyW');await sleep(130);await page.focus(select);await sleep(60);
        const focused=await page.evaluate(()=>document.querySelector('#model-viewport').userData.camera.position.toArray());await sleep(220);await page.keyboard.up('KeyW');
        check('Focusing an apartment control clears a previously held walking key',await page.evaluate(b=>{const u=document.querySelector('#model-viewport').userData,p=u.camera.position.toArray(),error=Math.hypot(...p.map((n,i)=>n-b[i]));return{pass:document.activeElement.matches('[data-apt-interaction]')&&error<1e-5,before:b,after:p,error};},focused));
      }
      await page.select(select,'apt-lights');await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);
      await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.actions.visuals.lights.some(l=>l.intensity>0),{polling:'raf'});
      check(example.id+' light control switches actual room lights and luminaire emissions',await page.evaluate(()=>{
        const u=document.querySelector('#model-viewport').userData,a=u.actions,v=u.apartment.interactionVisuals;
        return{pass:a.states.lights.on&&a.visuals.lights.length===u.apartment.data.rooms.length&&a.visuals.lights.every(l=>l.isPointLight&&l.intensity>0)&&v.lights.every(l=>l.material.emissiveIntensity>1),intensities:a.visuals.lights.map(l=>l.intensity),emissions:v.lights.map(l=>l.material.emissiveIntensity)};
      }));
      await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.actions.visuals.lights.every(l=>l.intensity===0),{polling:'raf'});
      check(example.id+' switching off restores all actual luminaires to zero',await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData;return{pass:!u.actions.states.lights.on&&u.actions.visuals.lights.every(l=>l.intensity===0)&&u.apartment.interactionVisuals.lights.every(l=>l.material.emissiveIntensity===0)};}));
      const televisionIds=await page.evaluate(()=>document.querySelector('#model-viewport').userData.actions.poi.filter(p=>p.type==='tv').map(p=>p.id));
      const tvChanges=[];
      for(const id of televisionIds){
        await page.select(select,id);await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);
        await page.waitForFunction(id=>{const a=document.querySelector('#model-viewport').userData.actions,r=a.visuals.televisions.find(r=>r.id===id);return a.states.televisions[r.index].on&&r.material.emissiveIntensity>.8;},{timeout:5000,polling:'raf'},id);
        const before=await page.evaluate(id=>{const a=document.querySelector('#model-viewport').userData.actions,r=a.visuals.televisions.find(r=>r.id===id);return{version:r.texture.version,bytes:[...r.texture.image.data],time:a.states.televisions[r.index].time};},id);
        await page.waitForFunction((id,b)=>{const a=document.querySelector('#model-viewport').userData.actions,r=a.visuals.televisions.find(r=>r.id===id);return r.texture.version>b.version&&r.texture.image.data.some((v,i)=>v!==b.bytes[i]);},{timeout:12000,polling:'raf'},id,before);
        const on=await page.evaluate((id,b)=>{const u=document.querySelector('#model-viewport').userData,a=u.actions,r=a.visuals.televisions.find(r=>r.id===id),p=a.poi.find(p=>p.id===id),walker=u.tour.position;return{id,pass:a.states.televisions[r.index].on&&r.material.map===r.texture&&r.material.emissiveMap===r.texture&&r.material.emissiveIntensity>.8&&r.texture.version>b.version&&r.texture.image.data.some((v,i)=>v!==b.bytes[i])&&u.apartment.world.free(walker.x,walker.z)&&Math.hypot(walker.x-p.x,walker.z-p.z)<=2.21,time:a.states.televisions[r.index].time,textureVersion:r.texture.version,previousVersion:b.version};},id,before);
        await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);
        await page.waitForFunction(id=>{const a=document.querySelector('#model-viewport').userData.actions,r=a.visuals.televisions.find(r=>r.id===id);return !a.states.televisions[r.index].on&&r.material.emissiveIntensity===0;},{polling:'raf'},id);
        const off=await page.evaluate(id=>{const a=document.querySelector('#model-viewport').userData.actions,r=a.visuals.televisions.find(r=>r.id===id);return !a.states.televisions[r.index].on&&r.material.emissiveIntensity===0;},id);
        tvChanges.push({...on,off});
      }
      check(example.id+' every television changes actual animated image pixels and switches off',{
        pass:tvChanges.length>=1&&tvChanges.every(r=>r.pass&&r.off),televisions:tvChanges});
      const fixtures=await page.evaluate(()=>document.querySelector('#model-viewport').userData.actions.poi.filter(p=>p.action==='apartment-pose').map(p=>({id:p.id,type:p.type,mode:p.pose.mode,fixtureIndex:p.fixtureIndex})));
      for(const fixture of fixtures){
        exercisedTypes.add(fixture.type);await page.select(select,fixture.id);
        await page.waitForFunction(id=>{const u=document.querySelector('#model-viewport').userData,p=u.actions.poi.find(p=>p.id===id),w=u.tour.position;return u.apartment.world.free(w.x,w.z)&&u.apartment.world.free(p.x,p.z)&&p.approach?.reachable&&p.pose.safe&&!u.actions.states.pose.id;},{polling:'raf'},fixture.id);
        await sleep(220);
        const standing=await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData;return{position:u.camera.position.toArray(),quaternion:u.camera.quaternion.toArray(),walker:u.tour.position,pose:u.tour.getPose()};});
        await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);
        await page.waitForFunction(id=>document.querySelector('#model-viewport').userData.actions.states.pose.id===id,{polling:'raf'},fixture.id);
        await sleep(250);
        check(example.id+' '+fixture.id+' places the actual camera on its modeled '+fixture.type,await page.evaluate(async(id,mode)=>{
          const T=await import('./vendor/three.module.js'),u=document.querySelector('#model-viewport').userData,p=u.actions.poses[id],target=u.apartment.root.localToWorld(new T.Vector3(...p.position)),actual=u.camera.position,local=u.apartment.root.worldToLocal(actual.clone());
          return{pass:u.actions.states.pose.id===id&&u.actions.states.pose.mode===mode&&p.safe&&actual.distanceTo(target)<1e-5&&Math.abs(local.y-p.eyeHeight)<1e-6&&((mode==='lying'&&local.y<1)||(mode==='seated'&&local.y>1&&local.y<1.4)),mode,actual:actual.toArray(),expected:target.toArray(),localEye:local.toArray(),fixtureIndex:p.fixtureIndex};
        },fixture.id,fixture.mode));
        // A bed/sofa/toilet pose must remain stable when an already-held move key
        // arrives; only the explicit stand control returns to free walking.
        await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.down('KeyW');await sleep(150);await page.keyboard.up('KeyW');
        check(example.id+' '+fixture.id+' suppresses walking while resting',await page.evaluate(async id=>{const T=await import('./vendor/three.module.js'),u=document.querySelector('#model-viewport').userData,p=u.actions.poses[id],expected=u.apartment.root.localToWorld(new T.Vector3(...p.position));return{pass:u.actions.states.pose.id===id&&u.camera.position.distanceTo(expected)<1e-5,position:u.camera.position.toArray()};},fixture.id));
        await page.click(stand);await page.waitForFunction(b=>{const u=document.querySelector('#model-viewport').userData,p=u.camera.position.toArray();return !u.actions.states.pose.id&&Math.hypot(...p.map((n,i)=>n-b.position[i]))<1e-5;},{polling:'raf'},standing);
        check(example.id+' '+fixture.id+' standing restores the exact safe viewpoint and direction',await page.evaluate(b=>{
          const u=document.querySelector('#model-viewport').userData,p=u.camera.position.toArray(),q=u.camera.quaternion.toArray(),w=u.tour.position;
          const positionError=Math.hypot(...p.map((n,i)=>n-b.position[i])),rotationError=Math.min(Math.hypot(...q.map((n,i)=>n-b.quaternion[i])),Math.hypot(...q.map((n,i)=>n+b.quaternion[i])));
          return{pass:u.tour.enabled&&!u.actions.states.pose.id&&!u.actions.savedStanding&&u.apartment.world.free(w.x,w.z)&&positionError<1e-5&&rotationError<1e-5,positionError,rotationError,walker:w,pose:u.tour.getPose()};
        },standing));
      }
      if(fixtures.length){
        await page.select(select,fixtures[0].id);await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{polling:'raf'},activate);await page.click(activate);await page.waitForFunction(()=>{const u=document.querySelector('#model-viewport').userData;return !!u.actions.states.pose.id&&u.tour.resting&&!u.tour.transitioning;},{polling:'raf'});
        await page.click('#model-viewport .apt-furniture');await page.waitForFunction(()=>!document.querySelector('#model-viewport').userData.apartment.withFurniture,{polling:'raf'});
        check(example.id+' hiding furniture safely stands up before its collision world changes',await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData,w=u.tour.position;return{pass:!u.apartment.withFurniture&&!u.actions.states.pose.id&&!u.actions.savedStanding&&u.tour.enabled&&u.apartment.world.free(w.x,w.z)&&!u.apartment.furniture.visible,walker:w};}));
        await page.click('#model-viewport .apt-furniture');await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.apartment.withFurniture,{polling:'raf'});
        check(example.id+' furniture can be restored with a safe furnished walking world',await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData,w=u.tour.position;return{pass:u.apartment.withFurniture&&u.apartment.furniture.visible&&u.apartment.world.free(w.x,w.z)&&!u.actions.states.pose.id,walker:w};}));
      }
      check(example.id+' all modeled beds, sofas, dining chairs and toilets have live controls',await page.evaluate(()=>{
        const u=document.querySelector('#model-viewport').userData,a=u.actions,rest=new Set(['bed','sofa','lsofa','chair','toilet']),expected=u.apartment.data.furniture.map((f,i)=>({type:f[0],index:i})).filter(f=>rest.has(f.type)),actual=a.poi.filter(p=>p.action==='apartment-pose');
        return{pass:expected.length>0&&actual.length===expected.length&&expected.every(e=>actual.some(p=>p.fixtureIndex===e.index&&p.type===e.type&&p.enabled&&p.pose.safe&&p.approach?.reachable&&u.apartment.world.free(p.x,p.z))),expected,actual:actual.map(p=>({id:p.id,type:p.type,fixtureIndex:p.fixtureIndex,enabled:p.enabled,approach:p.approach}))};
      }));
      // Observe real resource events, not a boolean disposed flag. Each scene
      // texture and geometry visible at close must be released exactly once.
      await page.evaluate(()=>{
        const u=document.querySelector('#model-viewport').userData,a=u.apartment,gs=new Set(),ts=new Set(),records=[];
        a.root.traverse(o=>{if(o.isMesh&&o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const slot of ['map','normalMap','bumpMap','roughnessMap','alphaMap','emissiveMap'])if(m[slot])ts.add(m[slot]);});
        for(const [kind,set]of [['geometry',gs],['texture',ts]])for(const object of set){const r={kind,name:object.name||object.type,disposals:0};object.addEventListener('dispose',()=>r.disposals++);records.push(r);}window.__aptResourceDisposals=records;
      });
      await page.click('#model-viewport .apt-exit');await page.waitForFunction(()=>!document.querySelector('#model-viewport').userData.tour.enabled,{polling:'raf'});
      await page.click('#sheet [data-apartment-close]');await page.waitForFunction(()=>!document.querySelector('#sheet').open&&!document.querySelector('#model-viewport')?.userData?.apartment,{polling:'raf'});
      check(example.id+' closing disposes every observed apartment geometry and texture once',await page.evaluate(()=>{
        const r=window.__aptResourceDisposals,bad=r.filter(r=>r.disposals!==1);return{pass:r.filter(r=>r.kind==='geometry').length>20&&r.filter(r=>r.kind==='texture').length>=4&&bad.length===0,resources:r.length,bad};
      }));
      await comparePose(example.id+' closing preserves the exact exterior map viewpoint',exterior);
    }
    for(const id of ['1-59','1-81']){
      await page.select(catalogSelector,id);await page.click('[data-open-plan]');
      await page.waitForFunction(id=>document.querySelector('#model-viewport')?.userData?.apartment?.root.name.startsWith('Apartment '+id+' '),{polling:'raf'},id);
      check(id+' reopens with fresh independent interactive state',await page.evaluate(()=>{const u=document.querySelector('#model-viewport').userData,a=u.actions;return{pass:!a.disposed&&!a.states.pose.id&&!a.states.lights.on&&Object.values(a.states.televisions).every(s=>!s.on)&&u.renderer.getContext().getError()===0&&document.querySelectorAll('#model-viewport .apartment-tour-hud').length===1,state:a.states};}));
      await page.click('#sheet [data-apartment-close]');await page.waitForFunction(()=>!document.querySelector('#sheet').open&&!document.querySelector('#model-viewport')?.userData?.apartment,{polling:'raf'});
      check(id+' repeated close removes its viewer and interactive HUD',await page.evaluate(()=>{const host=document.querySelector('#model-viewport');return{pass:!document.querySelector('#sheet').open&&(!host||(!host.apartmentViewer&&!host.userData?.apartment&&!host.querySelector('.apartment-tour-hud'))),connectedViewer:!!host};}));
    }
    check('The public catalog offers actual bed, sofa, chair and toilet viewpoints across its examples',{
      pass:['bed','sofa','chair','toilet'].every(t=>exercisedTypes.has(t)),types:[...exercisedTypes]});
  }

  try {
    await page.goto(base + '/index.html?view=genplan', {waitUntil: 'load'});
    await page.evaluate(async () => {
      const T = await import('./vendor/three.module.js');
      const prior = T.Scene.prototype.onBeforeRender;
      T.Scene.prototype.onBeforeRender = function(renderer, scene, camera, ...args) {
        prior?.call(this, renderer, scene, camera, ...args);
        if (renderer.domElement.closest('#cluster-map')) window.__rp = {renderer, scene, camera};
      };
      window.setMapView?.('district');
    });
    await page.waitForFunction(() => window.__rp && document.querySelector('#cluster-map')?.tourAPI);
    if(pointerOnly){
      await page.select('[data-plan-catalog]','1-81');await page.click('[data-open-plan]');await page.waitForFunction(()=>document.querySelector('#model-viewport')?.userData?.actions,{polling:'raf'});await page.click('#model-walk');await page.waitForFunction(()=>document.querySelector('#model-viewport').userData.tour.enabled,{polling:'raf'});await exerciseApartmentPointerAndLayout();
      await page.click('#model-viewport .apt-exit');await page.waitForFunction(()=>!document.querySelector('#model-viewport').userData.tour.enabled,{polling:'raf'});await page.click('#sheet [data-apartment-close]');await page.waitForFunction(()=>!document.querySelector('#sheet').open&&!document.querySelector('#model-viewport')?.userData?.apartment,{polling:'raf'});
    }else{
    check('Release 37', {pass: await page.evaluate(() => document.documentElement.dataset.release === '37')});
    await page.evaluate(() => document.querySelector('#cluster-map').solarEnvironment?.setDate('2026-07-15', 720));
    await page.click('#cluster-walk');
    await page.waitForFunction(() => !document.querySelector('#cluster-map .tour-hud').hidden);

    const ids = await page.evaluate(() => document.querySelector('#cluster-map').tourAPI.interactions.map(i => i.id));
    const doors = ['lobby-1', 'lobby-2', 'lobby-3', 'lobby-4', 'lobby-5', 'office-0', 'arena-entry', 'retail-1', 'retail-2', 'retail-3', 'sales-office'];
    check('Every section and commercial entrance is discoverable', {pass: doors.every(id => ids.includes(id)), ids});
    check('All exterior interaction approach points are safe', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      const bad = tour.interactions.filter(i => !i.point || !(i.world || tour.world).free(...i.point)).map(i => i.id);
      return {pass: bad.length === 0, bad, total: tour.interactions.length};
    }));

    check('Source panorama routing follows the actual courtyard, arena and offices', await page.evaluate(() => {
      const t=document.querySelector('#cluster-map').tourAPI,b=t.hud.querySelector('.tour-original');
      const mappings=[['lobby-1','courtyard'],['lobby-5','courtyard'],['office-0','forecourt'],['sales-office','forest'],['arena-entry','arena'],['retail-1','forecourt'],['cyber-seat-west','courtyard']];
      const result=mappings.map(([id,area])=>{t.goToInteraction(id);return{id,expected:area,actual:b.dataset.openOriginal};});
      t.teleport(t.destinations.findIndex(d=>d.name==='Кибердвор'));const destinationArea=b.dataset.openOriginal;
      return {pass:result.every(r=>r.actual===r.expected)&&destinationArea==='courtyard',result,destinationArea};
    }));

    for (let building = 1; building <= 5; building++) {
      const id = 'lobby-' + building, before = await openDoor(id, 'lobby', building);
      if (building === 1) {
        await exerciseSourceGallery();await exerciseLobby();await exerciseClub();
        await selectAmenity('resident-lift-parking');await clickAmenity('amenity-route','parking');await exerciseParking(building);
        await selectAmenity('parking-lift');await clickAmenity('amenity-route','lobby');
        await page.waitForFunction(()=>document.querySelector('.rp-showroom')?.dataset.kind==='lobby'&&document.querySelector('.rp-showroom')?.dataset.building==='1'&&document.querySelector('.rp-showroom')?.userData?.amenities?.club);
        check('Parking lift returns to the same first-floor section and preserves the exterior continuation',await page.evaluate(()=>{const d=document.querySelector('.rp-showroom'),t=document.querySelector('#cluster-map').tourAPI;return{pass:d.dataset.kind==='lobby'&&d.dataset.building==='1'&&d.dataset.walking==='true'&&!t.enabled&&t.hud.hidden};}));
        await exerciseApartmentHall(building);
        await page.select(room + ' [data-room-spot]', 'resident-lift');
        const liftButtons = await page.$$eval('.rp-showroom [data-guide-actions] button', buttons => buttons.map(b => b.textContent));
        check('First lobby lift offers floor 2 and floor 30', {pass: liftButtons.some(t => t.startsWith('2 этаж')) && liftButtons.some(t => t.startsWith('30 этаж')), buttons: liftButtons});
        await page.evaluate(() => [...document.querySelectorAll('.rp-showroom [data-guide-actions] button')].find(b => b.textContent.startsWith('30 этаж')).click());
        await page.waitForFunction(() => document.querySelector('.rp-showroom')?.dataset.kind === 'floor30' && document.querySelector('.rp-showroom')?.userData?.height > 80);
        check('Lobby elevator opens the actual 30th-floor showroom', {pass: true});
        await page.click(room + ' [data-lobby]');
        await page.waitForFunction(() => document.querySelector('.rp-showroom')?.dataset.kind === 'lobby' && !!document.querySelector('.rp-showroom')?.userData?.renderer);
        check('Elevator returns to first lobby without losing exterior continuation', {pass: true});
      }
      if(building===3)await exerciseApartmentHall(building);
      await closeDoor(before, id);
    }

    const officePose = await openDoor('office-0', 'office', 0);
    const officeFrom = await page.evaluate(() => document.querySelector('.rp-showroom').userData.walker);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down('KeyW'); await sleep(700); await page.keyboard.up('KeyW');
    check('Office interior supports real keyboard walking', await page.evaluate(before => {
      const u = document.querySelector('.rp-showroom').userData;
      return {pass: u.world.free(u.walker.x, u.walker.z) && Math.hypot(u.walker.x - before.x, u.walker.z - before.z) > .2,
        before, after: u.walker};
    }, officeFrom));
    await page.select(room + ' [data-room-spot]', 'meeting');
    await page.evaluate(() => [...document.querySelectorAll('.rp-showroom [data-guide-actions] button')].find(b => b.textContent.startsWith('Сесть')).click());
    await page.evaluate(() => {window.__qaSeatStableFrames = 0;});
    await page.waitForFunction(() => {
      const d = document.querySelector('.rp-showroom'), camera = d?.userData?.camera;
      const stable = d?.dataset.walking === 'false' && camera && Math.abs(camera.position.y - 1.22) < .001;
      window.__qaSeatStableFrames = stable ? window.__qaSeatStableFrames + 1 : 0;
      return window.__qaSeatStableFrames >= 3;
    }, {timeout: 5000, polling: 'raf'});
    check('Office meeting room provides a seated view at human eye height', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), u = d.userData;
      return {pass: d.dataset.walking === 'false' && Math.abs(u.camera.position.y - 1.22) < .001, camera: u.camera.position.toArray()};
    }));
    await page.select(room + ' [data-room-spot]', 'exit');
    await page.click(room + ' [data-guide-actions] button');
    await page.waitForFunction(() => !document.querySelector('.rp-showroom'));
    await sleep(180);
    await comparePose('Office interior exit returns to the exact exterior entrance', officePose);

    const arenaPose = await openDoor('arena-entry', 'arena');
    await page.select(room + ' [data-room-spot]', 'casters');
    await page.waitForFunction(() => {
      const d = document.querySelector('.rp-showroom'), u = d?.userData;
      const poi = u?.pois.find(p => p.id === 'casters'), camera = u?.camera;
      return !!poi && d.dataset.walking === 'true' && camera && Math.hypot(camera.position.x - poi.x, camera.position.z - poi.z) < 3.2 &&
        !d.querySelector('.rp-room-guide').hidden && d.querySelector('[data-guide-title]').textContent === poi.name;
    }, {timeout: 5000, polling: 'raf'});
    check('Arena offers an accessible caster workspace', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), u = d.userData;
      const poi = u.pois.find(p => p.id === 'casters'), p = u.camera.position;
      return {pass: !!poi && u.world.free(p.x, p.z) && Math.hypot(p.x - poi.x, p.z - poi.z) < 3.2 &&
        !d.querySelector('.rp-room-guide').hidden && d.querySelector('[data-guide-title]').textContent === poi.name,
        camera: p.toArray(), poi, title: d.querySelector('[data-guide-title]').textContent, concept: u.concept};
    }));
    await page.select(room + ' [data-room-spot]', 'arena-stage');
    for (const mode of ['presentation', 'welcome', 'match']) {
      const before = await page.evaluate(() => {
        const u = document.querySelector('.rp-showroom').userData;
        return {revision: u.screenModeRevision, textureVersion: u.scene.getObjectByName('Animated tournament display')?.material?.map?.version};
      });
      // A scene change must repaint even when its animation has been paused.
      if (mode === 'welcome') await page.click(room + ' [data-pause]');
      await page.click(room + ' [data-arena-mode="' + mode + '"]');
      await page.waitForFunction((mode, before) => {
        const u = document.querySelector('.rp-showroom')?.userData;
        const textureVersion = u?.scene.getObjectByName('Animated tournament display')?.material?.map?.version;
        return u?.arenaMode === mode && u.screenModeRevision > before.revision && textureVersion > before.textureVersion;
      }, {timeout: 5000, polling: 'raf'}, mode, before);
      check('Arena director applies ' + mode + ' to the actual animated display', await page.evaluate((mode, before) => {
        const d = document.querySelector('.rp-showroom'), u = d.userData;
        const textureVersion = u.scene.getObjectByName('Animated tournament display')?.material?.map?.version;
        return {pass: d.dataset.arenaMode === mode && u.arenaMode === mode && u.screenModeRevision > before.revision && textureVersion > before.textureVersion,
          mode: u.arenaMode, revision: u.screenModeRevision, textureVersion, before};
      }, mode, before));
    }
    await closeDoor(arenaPose, 'arena-entry');

    const retailPose = await openDoor('retail-1', 'retail');
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down('KeyD');
    try { await page.waitForFunction(() => document.querySelector('.rp-showroom').userData.walker.x >= 6.98, {timeout: 8000, polling: 'raf'}); }
    finally { await page.keyboard.up('KeyD'); }
    const stairsStart = await page.evaluate(() => ({...document.querySelector('.rp-showroom').userData.walker}));
    await page.keyboard.down('KeyW');
    try { await page.waitForFunction(() => document.querySelector('.rp-showroom').userData.height > 3.55, {timeout: 10000, polling: 'raf'}); }
    finally { await page.keyboard.up('KeyW'); }
    check('Original two-level retail staircase is climbed with keyboard movement', await page.evaluate(before => {
      const u = document.querySelector('.rp-showroom').userData;
      const treads = []; u.scene.traverse(o => {if (o.name === 'Walkable stair tread') treads.push(o);});
      return {pass: treads.length === 22 && u.height > 3.55 && Math.abs(u.camera.position.y - (u.height + 1.68)) < 1e-5 &&
        u.world.free(u.walker.x, u.walker.z) && u.walker.z < before.z - 5.8,
        treads: treads.length, start: before, end: u.walker, height: u.height};
    }, stairsStart));
    await closeDoor(retailPose, 'retail-1');
    for (const id of ['retail-2', 'retail-3', 'sales-office']) {
      const before = await openDoor(id, id === 'sales-office' ? 'office' : 'retail');
      await closeDoor(before, id);
    }

    // New v35 garden and elevated restaurant use their own physical approach
    // points; opening still uses the real E event and native dialog controls.
    const gardenPanel = 'dialog.rp-garden-controls[open]';
    check('Garden art and rooftop restaurant are discoverable without replacing existing activities', {
      pass: ['garden-breathing-art', 'restaurant-terrace-office', 'restaurant-dining-seat'].every(id => ids.includes(id)), ids
    });
    await approach('garden-breathing-art');
    const artPose = await pose();
    await page.keyboard.press('KeyE');
    await page.waitForSelector(gardenPanel);
    check('Physical garden art opens its local controls through E', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, d = t.gardenControls.dialog;
      return {pass: t.enabled && t.gardenControls.enabled && d.dataset.kind === 'garden-art' && !d.querySelector('[data-garden-art]').hidden, kind: d.dataset.kind};
    }));
    await page.evaluate(() => {
      const g = document.querySelector('#cluster-map').tourAPI.garden;
      window.__gardenPetalsBefore = Array.from(g.group.getObjectByName('Kinetic garden flower · nine batched bronze petals').instanceMatrix.array);
    });
    for (const [mode, color] of [['pulse', 0x649fbf], ['social', 0xd1aa63]]) {
      await page.click(gardenPanel + ' [data-garden-mode="' + mode + '"]');
      await page.waitForFunction((mode, color) => {
        const t = document.querySelector('#cluster-map').tourAPI, g = t.garden;
        const petals = g.group.getObjectByName('Kinetic garden flower · nine batched bronze petals');
        const lights = g.group.getObjectByName('Nine restrained fibre-light garden petals');
        return g.state.mode === mode && lights.material.emissive.getHex() === color &&
          petals.instanceMatrix.array.some((v, i) => Math.abs(v - window.__gardenPetalsBefore[i]) > 1e-5);
      }, {timeout: 5000, polling: 'raf'}, mode, color);
      check('Garden ' + mode + ' mode changes the actual light and kinetic petals', await page.evaluate((mode, color) => {
        const t = document.querySelector('#cluster-map').tourAPI, g = t.garden;
        const lights = g.group.getObjectByName('Nine restrained fibre-light garden petals');
        return {pass: g.state.mode === mode && lights.material.emissive.getHex() === color &&
          t.gardenControls.dialog.querySelector('[data-garden-mode="' + mode + '"]').getAttribute('aria-pressed') === 'true', state: g.state, color: lights.material.emissive.getHex()};
      }, mode, color));
    }
    await page.$eval(gardenPanel + ' [data-garden-intensity]', el => {el.value = '0'; el.dispatchEvent(new Event('input', {bubbles: true}));});
    await page.waitForFunction(() => document.querySelector('#cluster-map').tourAPI.garden.group.getObjectByName('Nine restrained fibre-light garden petals').material.emissiveIntensity === 0, {timeout: 5000});
    check('Zero garden light intensity extinguishes the actual material', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI;
      return {pass: t.garden.state.intensity === 0 && t.gardenControls.dialog.dataset.intensity === '0', state: t.garden.state};
    }));
    await page.$eval(gardenPanel + ' [data-garden-intensity]', el => {el.value = '.7'; el.dispatchEvent(new Event('input', {bubbles: true}));});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#cluster-map').tourAPI.gardenControls.enabled);
    check('Escape closes garden controls while keeping exterior walking active', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI;
      return {pass: t.enabled && !t.hud.hidden && !t.gardenControls.enabled};
    }));
    await comparePose('Garden controls preserve the exact pedestrian pose', artPose);

    await approach('restaurant-terrace-office');
    const restaurantPose = await pose();
    await page.keyboard.press('KeyE');
    await page.waitForSelector(gardenPanel);
    check('Restaurant opens at the existing elevated office terrace', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, i = t.interactions.find(i => i.id === 'restaurant-terrace-office');
      return {pass: t.gardenControls.dialog.dataset.kind === 'terrace-restaurant' && t.activeWorld === i.world &&
        Math.abs(t.elevation - i.elevation) < 1e-9 && i.elevation > 6.6 && i.world.free(t.position.x, t.position.z), elevation: t.elevation, position: t.position};
    }));
    // Matrix entries 6/5 are sin/cos of the X rotation, independent of its
    // translation; wait for the real easing to reach the declared target.
    for (const shade of [0, 1]) {
      const targetAngle = (1 - shade) * 1.28;
      await page.click(gardenPanel + ' [data-shade="' + shade + '"]');
      await page.waitForFunction((shade, targetAngle) => {
        const g = document.querySelector('#cluster-map').tourAPI.garden;
        const m = g.restaurant.group.getObjectByName('Authorial motorised restaurant shade · twenty batched louvers').instanceMatrix.array;
        return g.state.shade === shade && Math.abs(Math.atan2(m[6], m[5]) - targetAngle) < .0021;
      }, {timeout: 6000, polling: 'raf'}, shade, targetAngle);
      check('Restaurant shade ' + shade + ' reaches its actual louver angle', await page.evaluate((shade, targetAngle) => {
        const g = document.querySelector('#cluster-map').tourAPI.garden;
        const mesh = g.restaurant.group.getObjectByName('Authorial motorised restaurant shade · twenty batched louvers');
        const angles = Array.from({length: mesh.count}, (_, i) => Math.atan2(mesh.instanceMatrix.array[i * 16 + 6], mesh.instanceMatrix.array[i * 16 + 5]));
        return {pass: mesh.count === 20 && g.state.shade === shade && angles.every(a => Math.abs(a - targetAngle) < .0021), shade: g.state.shade, targetAngle, angles};
      }, shade, targetAngle));
    }
    // Capture the live exterior model before creating a cloned indoor section.
    // Geometric attributes/index buffers and object ownership must survive unchanged.
    // Keep live lighting attributes and moving traffic/garden instance matrices
    // out of this source-shape guard; the shop instance buffer is architectural.
    await page.evaluate(() => {
      const bytes = array => array ? new Uint8Array(array.buffer, array.byteOffset, array.byteLength).slice() : null;
      const guard = [], attributes = new Map(); window.__rp.scene.traverse(object => {
        if (!object.isMesh || !object.geometry?.attributes.position) return;
        if (!attributes.has(object.geometry)) attributes.set(object.geometry, Object.entries(object.geometry.attributes).filter(([name]) => ['position', 'normal', 'tangent', 'uv', 'uv1', 'color', 'rpAuthor'].includes(name)).map(([name, a]) => ({name, array: a.array, bytes: bytes(a.array)})));
        guard.push({object, geometry: object.geometry, material: object.material, attributes: attributes.get(object.geometry),
          indexBytes: bytes(object.geometry.index?.array),
          instanceBytes: object.name === 'Connected shop interiors across adjacent glazing with quieter upper galleries' ? bytes(object.instanceMatrix?.array) : null});
      }); window.__fitnessExteriorGuard = guard;
    });
    await page.click(gardenPanel + ' [data-garden-fitness]');
    await page.waitForFunction(() => {
      const d = document.querySelector('.rp-showroom');
      return d?.open && d.dataset.kind === 'fitness' && d.userData?.fitness;
    });
    check('Restaurant route opens author cardio on first floor with its declared source adaptation', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), u = d.userData, m = u.fitness.metadata;
      return {pass: d.dataset.building === '0' && d.dataset.walking === 'true' && m.sourceUnit === '3/5' &&
        m.sourceFloor === 3 && m.adaptedFloor === 1 && m.sourceArea === 105 && Math.abs(u.height - .24) < 1e-9 &&
        m.sourceMapping.scale === 1 && m.sourceMapping.survey === false && Math.abs(m.fitnessArea - 105) < .02,
        sourceFloor: m.sourceFloor, adaptedFloor: m.adaptedFloor, sourceArea: m.sourceArea, fitnessArea: m.fitnessArea, height: u.height};
    }));
    check('Fitness original plan bytes match their saved source evidence', await page.evaluate(async () => {
      const d = document.querySelector('.rp-showroom'), m = d.userData.fitness.metadata;
      const response = await fetch(d.querySelector('.rp-fitness-source img').getAttribute('src'));
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
      return {pass: response.ok && sha256 === '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296' && sha256 === m.sourceMapping.sourceImageSha256, sha256, sourceUrl: m.sourceUrl};
    }));
    check('Fitness retains the office outline and exposes street-facing exterior context', await page.evaluate(async () => {
      const {complexFootprints} = await import('./complex-footprints.js?v=publication371');
      const d = document.querySelector('.rp-showroom'), u = d.userData, f = u.fitness, m = f.metadata;
      const office = complexFootprints.buildings.find(b => b.id === 0), outline = office.shape.map(([x, z]) => [x + office.x, z + office.z]);
      const context = u.scene.getObjectByName('Exterior context for office fitness'), officeClone = context?.getObjectByName('Office 0');
      const normal = m.sourceMapping.streetFacingNormal, gym = u.scene.getObjectByName('Office floor 1 · adapted source-plan fitness concept');
      return {pass: JSON.stringify(outline) === JSON.stringify(f.worldOutline) && context?.visible && officeClone?.visible === false &&
        Math.abs(gym.position.y - .24) < 1e-9 && !!gym.getObjectByName('Panoramic glazing following the source polygon') &&
        normal[0] > .99 && Math.abs(normal[1]) < .04 && m.contextPlacement.worldCoordinates,
        outlinePoints: outline.length, streetFacingNormal: normal, contextOfficeVisible: officeClone?.visible, gymWorldBase: gym.position.toArray()};
    }));
    await page.waitForFunction(() => !!document.querySelector('.rp-showroom')?.userData?.fitness?.contextCut);
    check('Fitness section is applied only to its cloned office context', await page.evaluate(() => {
      const u = document.querySelector('.rp-showroom').userData, context = u.scene.getObjectByName('Exterior context for office fitness');
      const m = u.fitness.contextCut;
      return {pass: m === context.userData.fitnessContextCut && m.officeId === 0 && m.sourceGeometryUnchanged &&
        m.sourceMaterialsUnchanged && m.mainExteriorUnchanged && m.neighbouringPodiumPreserved &&
        m.replacements.length === 7 && m.frameFilters.length > 0 && m.hiddenShopInstances.length > 0,
        replacements: m.replacements.map(r => r.name), frameFilters: m.frameFilters.length, hiddenShopInstances: m.hiddenShopInstances.length};
    }));
    check('Opening the fitness section leaves every main-model source geometry byte intact', await page.evaluate(() => {
      const guard = window.__fitnessExteriorGuard;
      const equalBytes = (array, bytes) => {
        if (!array || array.byteLength !== bytes.length) return false;
        const actual = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < actual.length; i++) if (actual[i] !== bytes[i]) return false;
        return true;
      };
      const changed = guard.filter(s => s.object.geometry !== s.geometry || s.object.material !== s.material ||
        s.attributes.some(a => s.geometry.attributes[a.name]?.array !== a.array || !equalBytes(s.geometry.attributes[a.name]?.array, a.bytes)) ||
        (s.indexBytes && !equalBytes(s.geometry.index?.array, s.indexBytes)) ||
        (s.instanceBytes && !equalBytes(s.object.instanceMatrix?.array, s.instanceBytes)));
      return {pass: guard.length > 20 && changed.length === 0, meshes: guard.length, changed: changed.slice(0, 12).map(s => s.object.name)};
    }));
    await page.evaluate(async () => {
      const T = await import('./vendor/three.module.js');
      window.__fitnessContextRay = (origin, target, specificObjects = null) => {
        const u = document.querySelector('.rp-showroom').userData, context = u.scene.getObjectByName('Exterior context for office fitness');
        context.updateMatrixWorld(true);
        const a = new T.Vector3(...origin), b = new T.Vector3(...target), ray = new T.Raycaster(a, b.clone().sub(a).normalize(), .03, a.distanceTo(b) - .03);
        const visible = o => {for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true;};
        return (specificObjects ? ray.intersectObjects(specificObjects, false) : ray.intersectObject(context, true)).filter(h => {
          const m = Array.isArray(h.object.material) ? h.object.material[h.face?.materialIndex || 0] : h.object.material;
          return visible(h.object) && m?.visible !== false && !m?.transparent && (m?.opacity ?? 1) >= .95;
        }).map(h => ({name: h.object.name, distance: h.distance, point: h.point.toArray()}));
      };
    });
    const equipmentContextRays = [];
    for (const id of ['treadmill-1', 'cycle-1', 'rower-1']) {
      await page.select(room + ' [data-room-spot]', id);
      await page.click(room + ' [data-guide-close]');
      equipmentContextRays.push(await page.evaluate(id => {
        const u = document.querySelector('.rp-showroom').userData, p = u.fitness.metadata.workingFootprints.find(p => p.id === id);
        const origin = u.camera.position.toArray(), target = [p.x, u.height + p.viewTargetHeight, p.z];
        const hits = window.__fitnessContextRay(origin, target);
        return {id, origin, target, hits, safe: u.world.free(u.camera.position.x, u.camera.position.z)};
      }, id));
    }
    check('Actual equipment-eye views have no opaque exterior context cutting through the room', {
      pass: equipmentContextRays.length === 3 && equipmentContextRays.every(r => r.safe && Math.abs(r.origin[1] - 1.92) < 1e-5 && r.hits.length === 0), rays: equipmentContextRays
    });
    await page.click(room + ' [data-view="overview"]');
    await page.waitForFunction(() => document.querySelector('.rp-showroom').dataset.walking === 'false');
    check('Actual fitness overview can see its indoor target through the office section', await page.evaluate(async () => {
      const T = await import('./vendor/three.module.js'), u = document.querySelector('.rp-showroom').userData;
      const origin = u.camera.position.toArray(), direction = u.camera.getWorldDirection(new T.Vector3());
      const distance = (u.fitness.metadata.floorY + 1.2 - u.camera.position.y) / direction.y;
      const target = u.camera.position.clone().addScaledVector(direction, distance).toArray();
      const hits = window.__fitnessContextRay(origin, target);
      return {pass: distance > 0 && Number.isFinite(distance) && hits.length === 0, origin, target, hits};
    }));
    check('Neighbouring podium and roof remain naturally visible outside the office section', await page.evaluate(async () => {
      const {insideRing, solidContains} = await import('./walk-physics.js?v=publication371');
      const {complexFootprints} = await import('./complex-footprints.js?v=publication371');
      const u = document.querySelector('.rp-showroom').userData, context = u.scene.getObjectByName('Exterior context for office fitness');
      const m = u.fitness.contextCut, names = m.replacements.map(r => r.name);
      const originals = names.map(name => window.__rp.scene.getObjectByName(name)).filter(Boolean), replacements = names.map(name => context.getObjectByName(name)).filter(Boolean);
      const candidates = [68, 73, 77].flatMap(x => [-85, -75, -65].map(z => [x, z])).filter(p => !insideRing(...p, m.officeRing) && solidContains(...p, complexFootprints.podium));
      const results = candidates.map(point => {
        const from = [point[0], 14, point[1]], to = [point[0], .1, point[1]];
        const before = window.__fitnessContextRay(from, to, originals), after = window.__fitnessContextRay(from, to, replacements);
        const closest = hits => Object.fromEntries(names.map(name => [name, hits.filter(h => h.name === name).sort((a, b) => a.distance - b.distance)[0]?.distance]));
        const a = closest(before), b = closest(after);
        return {point, before: a, after: b, sourceHits: before.length,
          pass: names.every(name => a[name] === undefined ? b[name] === undefined : b[name] !== undefined && Math.abs(a[name] - b[name]) < .0002)};
      });
      return {pass: results.length >= 3 && results.filter(r => r.sourceHits > 0).length >= 3 && results.every(r => r.pass), samples: results};
    }));
    await page.select(room + ' [data-room-spot]', 'treadmill-1');
    await page.click(room + ' [data-guide-close]');
    await page.evaluate(() => document.activeElement?.blur());
    const fitnessFrom = await page.evaluate(() => ({...document.querySelector('.rp-showroom').userData.walker}));
    const fitnessWalkKey = await page.evaluate(() => {
      const u = document.querySelector('.rp-showroom').userData;
      const yaw = u.camera.rotation.y;
      return [['KeyW', 0, 1], ['KeyS', 0, -1], ['KeyA', -1, 0], ['KeyD', 1, 0]].map(([key, right, forward]) => {
        const dx = (Math.cos(yaw) * right - Math.sin(yaw) * forward) * .4;
        const dz = (-Math.sin(yaw) * right - Math.cos(yaw) * forward) * .4;
        const p = u.world.move(u.walker, dx, dz); return {key, distance: Math.hypot(p.x - u.walker.x, p.z - u.walker.z)};
      }).sort((a, b) => b.distance - a.distance)[0].key;
    });
    await page.keyboard.down(fitnessWalkKey); await sleep(400); await page.keyboard.up(fitnessWalkKey);
    check('Fitness permits actual safe keyboard walking beside equipment', await page.evaluate(before => {
      const u = document.querySelector('.rp-showroom').userData;
      return {pass: u.world.free(u.walker.x, u.walker.z) && Math.hypot(u.walker.x - before.x, u.walker.z - before.z) > .025 &&
        Math.abs(u.camera.position.y - 1.92) < 1e-5, before, after: u.walker, eye: u.camera.position.y};
    }, fitnessFrom));
    // A source-level movement key is already held when the native time
    // range gains focus. Choose a real POI with an unobstructed forward step.
    const fitnessForwardPoi = await page.evaluate(() => {
      const u = document.querySelector('.rp-showroom').userData, yaw = u.camera.rotation.y;
      return u.pois.map(poi => {
        const start = u.world.nearest([poi.x, poi.z], 3);
        if (!start) return {id: poi.id, distance: 0};
        const end = u.world.move(start, -Math.sin(yaw) * .4, -Math.cos(yaw) * .4);
        return {id: poi.id, distance: Math.hypot(end.x - start.x, end.z - start.z)};
      }).sort((a, b) => b.distance - a.distance)[0].id;
    });
    await page.select(room + ' [data-room-spot]', fitnessForwardPoi);
    await page.click(room + ' [data-guide-close]');
    await page.evaluate(() => document.activeElement?.blur());
    const gymFocusBefore = await page.evaluate(() => document.querySelector('.rp-showroom').userData.camera.position.toArray());
    await page.keyboard.down('KeyW'); await sleep(180);
    const gymFocusMoving = await page.evaluate(() => document.querySelector('.rp-showroom').userData.camera.position.toArray());
    await page.focus(room + ' [data-time]'); await sleep(80);
    const gymFocusHeld = await page.evaluate(() => document.querySelector('.rp-showroom').userData.camera.position.toArray());
    await sleep(350); await page.keyboard.up('KeyW');
    check('Fitness time input clears a genuinely held forward key without leaking movement', await page.evaluate((before, moving, held) => {
      const d = document.querySelector('.rp-showroom'), p = d.userData.camera.position.toArray();
      const initialMovement = Math.hypot(...moving.map((v, i) => v - before[i]));
      const focusMovement = Math.hypot(...p.map((v, i) => v - held[i]));
      return {pass: initialMovement > .025 && focusMovement < 1e-5 && d.dataset.walking === 'true' &&
        d.querySelector('[data-time]') === document.activeElement, initialMovement, focusMovement, before, held, after: p};
    }, gymFocusBefore, gymFocusMoving, gymFocusHeld));
    await page.select(room + ' [data-room-spot]', 'treadmill-1');
    await page.evaluate(() => {
      const scene = document.querySelector('.rp-showroom').userData.scene;
      const machine = []; scene.traverse(o => {if (o.userData.equipmentId === 'treadmill-1') machine.push(o);});
      window.__fitnessBelt = machine[0].getObjectByName('Curved continuous running belt');
      window.__fitnessBeltBefore = window.__fitnessBelt.material.map.offset.y;
    });
    await page.click(room + ' [data-fitness-toggle="treadmill-1"]');
    await page.waitForFunction(() => {
      const f = document.querySelector('.rp-showroom').userData.fitness;
      return f.state['treadmill-1'].running && f.state['treadmill-1'].seconds > .15 && Math.abs(window.__fitnessBelt.material.map.offset.y - window.__fitnessBeltBefore) > .02;
    }, {timeout: 5000, polling: 'raf'});
    check('Treadmill control animates its actual running belt', await page.evaluate(() => {
      const state = document.querySelector('.rp-showroom').userData.fitness.state['treadmill-1'];
      return {pass: state.running && state.seconds > .15 && Math.abs(window.__fitnessBelt.material.map.offset.y - window.__fitnessBeltBefore) > .02,
        state, beltBefore: window.__fitnessBeltBefore, beltAfter: window.__fitnessBelt.material.map.offset.y};
    }));
    await page.click(room + ' [data-fitness-toggle="treadmill-1"]');
    await page.waitForFunction(() => !document.querySelector('.rp-showroom').userData.fitness.state['treadmill-1'].running, {timeout: 5000});
    const stoppedBelt = await page.evaluate(() => window.__fitnessBelt.material.map.offset.y);
    await sleep(250);
    check('Stopping the treadmill freezes its real belt without leaving walking mode', await page.evaluate(before => {
      const d = document.querySelector('.rp-showroom'), state = d.userData.fitness.state['treadmill-1'];
      return {pass: !state.running && d.dataset.walking === 'true' && window.__fitnessBelt.material.map.offset.y === before,
        state, beltBefore: before, beltAfter: window.__fitnessBelt.material.map.offset.y};
    }, stoppedBelt));
    await page.select(room + ' [data-room-spot]', 'cycle-1');
    await page.evaluate(() => {
      const scene = document.querySelector('.rp-showroom').userData.scene;
      scene.traverse(o => {if (o.userData.equipmentId === 'cycle-1') window.__fitnessCycle = o.getObjectByName('Cycle flywheel inner rotor');});
      window.__fitnessCycleBefore = window.__fitnessCycle.rotation.x;
    });
    await page.click(room + ' [data-fitness-toggle="cycle-1"]');
    await page.waitForFunction(() => document.querySelector('.rp-showroom').userData.fitness.state['cycle-1'].running &&
      Math.abs(window.__fitnessCycle.rotation.x - window.__fitnessCycleBefore) > .2, {timeout: 5000, polling: 'raf'});
    check('Cycle control animates the independent flywheel', await page.evaluate(() => ({
      pass: document.querySelector('.rp-showroom').userData.fitness.state['cycle-1'].running && Math.abs(window.__fitnessCycle.rotation.x - window.__fitnessCycleBefore) > .2,
      before: window.__fitnessCycleBefore, after: window.__fitnessCycle.rotation.x
    })));
    async function cycleRate(speed) {
      await page.$eval(room + ' [data-fitness-speed="cycle-1"]', (el, speed) => {
        el.value = String(speed); el.dispatchEvent(new Event('input', {bubbles: true}));
      }, speed);
      await page.waitForFunction(speed => document.querySelector('.rp-showroom').userData.fitness.state['cycle-1'].resistance === speed,
        {timeout: 5000, polling: 'raf'}, speed);
      return page.evaluate(() => new Promise(resolve => {
        let frame = 0, first;
        function sample() {
          const state = document.querySelector('.rp-showroom').userData.fitness.state['cycle-1'];
          const current = {angle: window.__fitnessCycle.rotation.x, seconds: state.seconds, resistance: state.resistance};
          if (!first) first = current;
          if (++frame < 9) {requestAnimationFrame(sample); return;}
          resolve({speed: current.resistance, angularStep: current.angle - first.angle, elapsed: current.seconds - first.seconds,
            radiansPerSecond: (current.angle - first.angle) / (current.seconds - first.seconds)});
        }
        requestAnimationFrame(sample);
      }));
    }
    const slowCycle = await cycleRate(1), fastCycle = await cycleRate(10);
    check('Fitness speed slider changes the real cycle angular rate', {
      pass: slowCycle.speed === 1 && fastCycle.speed === 10 && slowCycle.elapsed > 0 && fastCycle.elapsed > 0 &&
        Number.isFinite(slowCycle.radiansPerSecond) && Number.isFinite(fastCycle.radiansPerSecond) &&
        slowCycle.radiansPerSecond > 0 && fastCycle.radiansPerSecond > slowCycle.radiansPerSecond * 2,
      slow: slowCycle, fast: fastCycle
    });
    await page.click(room + ' [data-fitness-toggle="cycle-1"]');
    await page.select(room + ' [data-room-spot]', 'fitness-reception');
    await page.click(room + ' [data-fitness-toggle="all"]');
    await page.waitForFunction(() => {
      const state = document.querySelector('.rp-showroom').userData.fitness.state;
      return Object.values(state).filter(s => s.animated).every(s => s.running && s.seconds > .1);
    }, {timeout: 5000, polling: 'raf'});
    check('Cardio-zone control starts all eight supported machines while keeping the weight rack static', await page.evaluate(() => {
      const state = document.querySelector('.rp-showroom').userData.fitness.state, machines = Object.values(state);
      return {pass: machines.length === 9 && machines.filter(s => s.animated).length === 8 &&
        machines.filter(s => s.animated).every(s => s.running) && !state['weights-1'].running, state};
    }));
    await page.click(room + ' [data-fitness-toggle="all"]');
    await page.select(room + ' [data-room-spot]', 'fitness-source');
    await page.evaluate(() => [...document.querySelectorAll('.rp-showroom [data-guide-actions] button')].find(b => b.textContent.includes('Показать исходную')).click());
    await page.waitForFunction(() => {
      const d = document.querySelector('.rp-showroom'), img = d.querySelector('.rp-fitness-source img');
      return d.querySelector('.rp-fitness-source').open && img.complete && img.naturalWidth > 0;
    });
    check('Fitness guide opens the actual readable original plan', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), source = d.querySelector('.rp-fitness-source'), img = source.querySelector('img');
      return {pass: source.open && img.complete && img.naturalWidth > 0 && source.textContent.includes('Этаж источника: 3'), width: img.naturalWidth, height: img.naturalHeight};
    }));
    await page.$eval(room + ' [data-time]', el => {el.value = '1230'; el.dispatchEvent(new Event('input', {bubbles: true}));});
    await page.waitForFunction(() => document.querySelector('.rp-showroom').dataset.solarTime === '20:30', {timeout: 5000});
    check('Fitness time slider shares the exterior solar selection', await page.evaluate(async () => {
      const {getSolarSnapshot} = await import('./solar-clock.js?v=publication371');
      const d = document.querySelector('.rp-showroom'), s = getSolarSnapshot();
      return {pass: s.parts.minutes === 1230 && d.dataset.solarTime === '20:30', minutes: s.parts.minutes, time: d.dataset.solarTime};
    }));
    await page.setViewport({width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true});
    await page.$eval(room + ' .rp-fitness-source', el => {el.open = false;});
    await sleep(180);
    check('Mobile fitness walking controls, exit and time slider fit the viewport', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom');
      const selectors = ['[data-stick="move"]', '[data-stick="look"]', '[data-close]', '[data-room-spot]', '[data-time]', '[data-fitness-lobby]'];
      const rects = selectors.map(selector => {
        const el = d.querySelector(selector), r = el?.getBoundingClientRect();
        return {selector, x: r?.x, y: r?.y, right: r?.right, bottom: r?.bottom, width: r?.width, height: r?.height};
      });
      return {pass: rects.every(r => r.width > 0 && r.height > 0 && r.x >= -.1 && r.y >= -.1 && r.right <= innerWidth + .1 && r.bottom <= innerHeight + .1), rects};
    }));
    await page.screenshot({path: out + '/mobile-fitness.png'});
    await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1, hasTouch: true});
    await page.click(room + ' [data-fitness-lobby]');
    await page.waitForFunction(() => document.querySelector('.rp-showroom')?.dataset.kind === 'office' && document.querySelector('.rp-showroom')?.userData?.renderer);
    check('Fitness returns to its office lobby without completing the exterior continuation early', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom'), t = document.querySelector('#cluster-map').tourAPI;
      return {pass: d.dataset.kind === 'office' && d.dataset.building === '0' && d.dataset.walking === 'true' && !t.enabled && t.hud.hidden};
    }));
    await closeDoor(restaurantPose, 'restaurant → fitness → office');
    await page.evaluate(() => document.querySelector('#cluster-map').solarEnvironment?.setDate('2026-07-15', 720));

    await approach('restaurant-terrace-office');
    const rooftopBefore = await pose();
    await page.keyboard.down('KeyS'); await sleep(400); await page.keyboard.up('KeyS');
    check('Restaurant terrace supports real safe elevated walking', await page.evaluate(before => {
      const t = document.querySelector('#cluster-map').tourAPI, p = window.__rp.camera.position;
      const i = t.interactions.find(i => i.id === 'restaurant-terrace-office');
      return {pass: t.activeWorld === i.world && i.world.free(p.x, p.z) && Math.abs(t.elevation - i.elevation) < 1e-9 &&
        Math.hypot(p.x - before.position[0], p.z - before.position[2]) > .025, before: before.position, after: p.toArray(), elevation: t.elevation};
    }, rooftopBefore));
    await approach('restaurant-dining-seat'); await page.keyboard.press('KeyE'); await sleep(150);
    check('Existing restaurant chair provides a seated elevated view', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, i = t.interactions.find(i => i.id === 'restaurant-dining-seat');
      return {pass: t.seated === i.id && t.activeWorld === i.world && Math.abs(window.__rp.camera.position.y - (i.seatHeight + .82)) < 1e-5,
        seated: t.seated, seatedEye: window.__rp.camera.position.y, expectedEye: i.seatHeight + .82};
    }));
    await page.keyboard.press('KeyE'); await sleep(150);
    check('Standing from restaurant chair retains the rooftop walking world', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, i = t.interactions.find(i => i.id === 'restaurant-dining-seat');
      return {pass: !t.seated && t.activeWorld === i.world && i.world.free(t.position.x, t.position.z) && Math.abs(t.elevation - i.elevation) < 1e-9, position: t.position, elevation: t.elevation};
    }));
    await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, r = t.garden.restaurant;
      window.__gardenRefs = t.garden.obstacles.slice();
      window.__restaurantRefs = r.obstacles.slice();
      window.__originalRoofRefs = r.world.obstacles.filter(o => !window.__restaurantRefs.includes(o));
      window.__originalRoofEnabled = window.__originalRoofRefs.map(o => o.enabled);
    });
    await page.click(host + ' [data-cyber-visible]'); await sleep(150);
    check('Hiding author proposals disables garden and restaurant references while preserving original roof collision', await page.evaluate(() => {
      const t = document.querySelector('#cluster-map').tourAPI, g = t.garden, r = g.restaurant;
      return {pass: !g.visible && !r.visible && window.__gardenRefs.length > 0 && window.__restaurantRefs.length === 4 &&
        window.__gardenRefs.every(o => t.world.obstacles.includes(o) && o.enabled === false) &&
        window.__restaurantRefs.every(o => r.world.obstacles.includes(o) && o.enabled === false) &&
        window.__originalRoofRefs.every((o, i) => r.world.obstacles.includes(o) && o.enabled === window.__originalRoofEnabled[i]),
        gardenColliders: window.__gardenRefs.length, newRoofColliders: window.__restaurantRefs.length, originalRoofColliders: window.__originalRoofRefs.length};
    }));
    await page.click(host + ' [data-cyber-visible]'); await sleep(150);
    check('Showing proposals restores garden and restaurant collider objects', await page.evaluate(() => {
      const g = document.querySelector('#cluster-map').tourAPI.garden;
      return {pass: g.visible && g.restaurant.visible && [...window.__gardenRefs, ...window.__restaurantRefs].every(o => o.enabled !== false)};
    }));

    check('All six authored courtyard activities survived safe placement', await page.evaluate(() => {
      const group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      const metadata = group?.userData.concept;
      return {pass: metadata?.interactions === 6 && metadata.skipped.length === 0,
        placements: metadata?.placements, skipped: metadata?.skipped, meshCount: metadata?.meshCount};
    }));
    const benchId = ids.find(id => id.startsWith('cyber-seat-'));
    await approach(benchId);
    const benchStanding = await pose();
    await page.keyboard.down('KeyE');
    await sleep(160);
    check('Authored curved bench supports an actual seated camera', await page.evaluate(before => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      return {pass: !!tour.seated && window.__rp.camera.position.y < before.position[1] - .2,
        seated: tour.seated, standingEye: before.position[1], seatedEye: window.__rp.camera.position.y};
    }, benchStanding));
    await page.keyboard.down('KeyE'); await sleep(110);
    check('A repeated held E does not toggle the bench a second time', await page.evaluate(id => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      return {pass: tour.seated === id, seated: tour.seated};
    }, benchId));
    await page.keyboard.up('KeyE');
    await page.keyboard.press('KeyE'); await sleep(160);
    check('Standing up returns to a safe pedestrian point', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI, p = window.__rp.camera.position;
      return {pass: !tour.seated && tour.world.free(p.x, p.z), position: p.toArray()};
    }));

    await approach(benchId); await page.keyboard.press('KeyE'); await sleep(150);
    await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      window.__cyberObstacleRefs = tour.world.obstacles.filter(o => o.source === 'cyber-courtyard-v34');
      window.__cyberTableObstacle = window.__cyberObstacleRefs.find(o => o.type === 'box' && o.interactionId.startsWith('cyber-table-'));
      window.__cyberBlockedBefore = !tour.world.free(window.__cyberTableObstacle.x, window.__cyberTableObstacle.z);
    });
    await page.click(host + ' [data-cyber-visible]'); await sleep(160);
    check('Hiding authored layer disables the same collider objects and safely stands up', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI, refs = window.__cyberObstacleRefs;
      const box = window.__cyberTableObstacle, group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      const p = window.__rp.camera.position;
      return {pass: window.__cyberBlockedBefore && !group.visible && !tour.seated && refs.length > 0 &&
        refs.every(o => tour.world.obstacles.includes(o) && o.enabled === false) && tour.world.free(box.x, box.z) && tour.world.free(p.x, p.z),
        colliders: refs.length, tableFree: tour.world.free(box.x, box.z), seated: tour.seated};
    }));
    await page.click(host + ' [data-cyber-visible]'); await sleep(160);
    check('Re-enabling authored layer restores collision without replacing references', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI, refs = window.__cyberObstacleRefs, box = window.__cyberTableObstacle;
      const group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      return {pass: group.visible && refs.every(o => tour.world.obstacles.includes(o) && o.enabled !== false) && !tour.world.free(box.x, box.z), colliders: refs.length};
    }));
    await page.evaluate(() => {
      const group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      const materials = []; group.traverse(o => {if (o.material) materials.push(...(Array.isArray(o.material) ? o.material : [o.material]));});
      const cyan = materials.find(m => m.color?.getHex() === 0xaacac7), map = materials.find(m => m.map?.name?.startsWith('Authored reaction display'))?.map;
      window.__cyberEventBefore = {cyanIntensity: cyan?.emissiveIntensity, displayVersion: map?.version};
    });
    await page.click(host + ' [data-cyber-event]');
    await page.waitForFunction(() => {
      const group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      const materials = []; group.traverse(o => {if (o.material) materials.push(...(Array.isArray(o.material) ? o.material : [o.material]));});
      const cyan = materials.find(m => m.color?.getHex() === 0xaacac7), map = materials.find(m => m.map?.name?.startsWith('Authored reaction display'))?.map;
      return map?.version > window.__cyberEventBefore.displayVersion && cyan?.emissiveIntensity > window.__cyberEventBefore.cyanIntensity + .05;
    }, {timeout: 5000});
    check('Courtyard event mode is operable from the live HUD', await page.evaluate(() => {
      const b = document.querySelector('#cluster-map [data-cyber-event]');
      const group = window.__rp.scene.getObjectByName('Optional authored cyber courtyard · calm timber and mineral furniture');
      const materials = []; group.traverse(o => {if (o.material) materials.push(...(Array.isArray(o.material) ? o.material : [o.material]));});
      const cyan = materials.find(m => m.color?.getHex() === 0xaacac7), map = materials.find(m => m.map?.name?.startsWith('Authored reaction display'))?.map;
      const before = window.__cyberEventBefore;
      return {pass: b.getAttribute('aria-pressed') === 'true' && cyan?.emissiveIntensity > before.cyanIntensity + .05 && map?.version > before.displayVersion,
        ariaPressed: b.getAttribute('aria-pressed'), before, cyanIntensity: cyan?.emissiveIntensity, displayVersion: map?.version};
    }));
    await page.click(host + ' [data-cyber-event]');

    const reactionId = ids.find(id => id.startsWith('cyber-reaction-'));
    await openActivity(reactionId, 'reaction');
    // Idle Space belongs to the native focused button and activates on keyup.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#cluster-map').tourAPI.activities.state.phase === 'wait');
    check('Space on the initial focused start button starts the reaction trainer', await page.evaluate(() => {
      const state = document.querySelector('#cluster-map').tourAPI.activities.state;
      return {pass: state.phase === 'wait' && state.round === 0 && state.samples.length === 0, state};
    }));
    await page.keyboard.down('Space');
    check('Reaction trainer rejects a false start without recording a result', await page.evaluate(() => {
      const state = document.querySelector('#cluster-map').tourAPI.activities.state;
      return {pass: state.phase === 'early' && state.round === 0 && state.samples.length === 0, state};
    }));
    await page.waitForFunction(() => document.querySelector('#cluster-map').tourAPI.activities.state.phase === 'wait', {timeout: 2500});
    await page.keyboard.down('Space');
    check('A held Space repeat does not cause a second false start in the repeated round', await page.evaluate(() => {
      const state = document.querySelector('#cluster-map').tourAPI.activities.state;
      return {pass: state.phase === 'wait' && state.round === 0 && state.samples.length === 0, state};
    }));
    await page.keyboard.up('Space');
    for (let round = 0; round < 5; round++) {
      await page.waitForFunction(round => {
        const s = document.querySelector('#cluster-map').tourAPI.activities.state;
        return s.phase === 'signal' && s.round === round;
      }, {timeout: 6000, polling: 'raf'}, round);
      await page.keyboard.press('Space');
    }
    check('Five real reaction signals produce a finite average and local best record', await page.evaluate(() => {
      const s = document.querySelector('#cluster-map').tourAPI.activities.state;
      const average = Math.round(s.samples.reduce((a, b) => a + b, 0) / s.samples.length);
      const best = Number(localStorage.getItem('rodina-reaction-best-v1'));
      return {pass: s.phase === 'done' && s.round === 5 && s.samples.length === 5 &&
        s.samples.every(v => Number.isFinite(v) && v >= 0) && Number.isFinite(average) && best > 0,
        samples: s.samples, average, best};
    }));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#cluster-map').tourAPI.activities.enabled);
    check('Escape closes only the reaction trainer and keeps exterior walking active', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      return {pass: tour.enabled && !tour.hud.hidden && !tour.activities.enabled};
    }));

    const tableId = ids.find(id => id.startsWith('cyber-table-'));
    await openActivity(tableId, 'memory'); await page.click(game + ' [data-start]');
    await page.waitForFunction(() => document.querySelector('#cluster-map').tourAPI.activities.state.phase === 'input');
    const sequence1 = await page.evaluate(() => document.querySelector('#cluster-map').tourAPI.activities.state.sequence);
    for (const tile of sequence1) await page.click(game + ' [data-tile="' + tile + '"]');
    // Observe the next presentation first: level increments before the next
    // input phase, so matching only level+input could accept the old phase.
    await page.waitForFunction(() => {const s = document.querySelector('#cluster-map').tourAPI.activities.state; return s.phase === 'show' && s.level === 2;}, {timeout: 6000});
    await page.waitForFunction(() => {const s = document.querySelector('#cluster-map').tourAPI.activities.state; return s.phase === 'input' && s.level === 2;}, {timeout: 6000});
    check('Correct tabletop sequence advances and preserves the learned prefix', await page.evaluate(previous => {
      const s = document.querySelector('#cluster-map').tourAPI.activities.state;
      return {pass: s.level === 2 && s.sequence.length === 2 && previous.every((v, i) => s.sequence[i] === v), previous, state: s};
    }, sequence1));
    const wrong = await page.evaluate(() => (document.querySelector('#cluster-map').tourAPI.activities.state.sequence[0] + 1) % 4);
    await page.click(game + ' [data-tile="' + wrong + '"]');
    check('A wrong tabletop sequence ends the round with a usable restart', await page.evaluate(() => {
      const s = document.querySelector('#cluster-map').tourAPI.activities.state;
      return {pass: s.phase === 'done' && !document.querySelector('dialog.courtyard-activity[open] [data-start]').disabled, state: s};
    }));
    await page.click(game + ' [data-close]');

    // A key already held when a native form control gains focus must be
    // cleared. Merely filtering subsequent keydown events is insufficient.
    await approach(tableId);
    const beforeFocusWalk = await pose();
    await page.keyboard.down('KeyW'); await sleep(180);
    const walkedBeforeFocus = await pose();
    check('Focus regression begins with genuine unobstructed walking', {pass:
      Math.hypot(walkedBeforeFocus.position[0] - beforeFocusWalk.position[0], walkedBeforeFocus.position[2] - beforeFocusWalk.position[2]) > .025,
      before: beforeFocusWalk.position, after: walkedBeforeFocus.position});
    await page.focus(host + ' [data-tour-target]'); await sleep(100);
    const heldFocusPose = await pose();
    await sleep(350); await page.keyboard.up('KeyW');
    await comparePose('Focusing a destination select clears a previously held movement key', heldFocusPose);

    // At the first option ArrowUp does not select another destination, so any
    // camera translation here can only be leaked walking input.
    const select = host + ' [data-tour-target]';
    await page.evaluate(() => {
      const select = document.querySelector('#cluster-map [data-tour-target]');
      select.selectedIndex = 0; select.dispatchEvent(new Event('change', {bubbles: true})); select.focus();
    });
    await sleep(200); const focusedPose = await pose();
    await page.keyboard.down('ArrowUp'); await sleep(400); await page.keyboard.up('ArrowUp');
    await page.keyboard.down('KeyW'); await sleep(300); await page.keyboard.up('KeyW');
    await comparePose('Keyboard input on a destination select does not move the walker', focusedPose);
    check('Destination select retained keyboard focus', {pass: await page.$eval(select, e => e === document.activeElement)});
    await page.keyboard.press('Escape');
    check('Escape still exits walking when a destination select has focus', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      return {pass: !tour.enabled && tour.hud.hidden && !document.querySelector('#cluster-map').classList.contains('tour-active')};
    }));
    await approach(tableId);

    await page.setViewport({width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true});
    await page.evaluate(() => document.activeElement?.blur()); await sleep(250);
    check('Mobile walking controls and interaction button fit the viewport', await page.evaluate(() => {
      const hud = document.querySelector('#cluster-map .tour-hud');
      const selectors = ['.tour-exit', '.tour-interact', '.tour-joystick', '.tour-look-stick', '[data-tour-target]'];
      const rects = selectors.map(selector => {
        const el = hud.querySelector(selector); if (!el) return {selector, missing: true};
        const r = el.getBoundingClientRect(), style = getComputedStyle(el);
        return {selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom,
          visible: style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0};
      });
      return {pass: rects.every(r => !r.missing && r.visible && r.x >= -.1 && r.y >= -.1 && r.right <= innerWidth + .1 && r.bottom <= innerHeight + .1), rects};
    }));
    await page.screenshot({path: out + '/mobile-interaction.png'});
    const mobileLobbyPose=await openDoor('lobby-1','lobby',1);
    check('Mobile first-floor selectors, gallery entry and movement controls fit the viewport',await page.evaluate(()=>{
      const d=document.querySelector('.rp-showroom'),selectors=['[data-stick=move]','[data-stick=look]','[data-close]','[data-room-spot]','[data-resident-room]','[data-source-gallery]'],rects=selectors.map(selector=>{const el=d.querySelector(selector),r=el?.getBoundingClientRect();return{selector,x:r?.x,y:r?.y,right:r?.right,bottom:r?.bottom,width:r?.width,height:r?.height};});
      return{pass:rects.every(r=>r.width>0&&r.height>0&&r.x>=-.1&&r.y>=-.1&&r.right<=innerWidth+.1&&r.bottom<=innerHeight+.1),rects};
    }));
    await page.click(room+' [data-source-gallery]');await page.waitForSelector('dialog.rp-source-gallery[open]');
    check('Mobile source gallery and its close button fit the viewport',await page.evaluate(()=>{
      const d=document.querySelector('dialog.rp-source-gallery[open]'),r=d.getBoundingClientRect(),c=d.querySelector('[data-reference-close]').getBoundingClientRect();return{pass:r.x>=-.1&&r.right<=innerWidth+.1&&r.y>=-.1&&r.bottom<=innerHeight+.1&&c.x>=r.x&&c.right<=r.right&&c.y>=r.y&&c.bottom<=r.bottom,gallery:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},close:{x:c.x,y:c.y,right:c.right,bottom:c.bottom}};
    }));
    await page.screenshot({path:out+'/mobile-source-gallery.png'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog.rp-source-gallery[open]'));
    check('Mobile nested-gallery Escape preserves the resident lobby',await page.evaluate(()=>{const d=document.querySelector('.rp-showroom');return{pass:d?.open&&d.dataset.kind==='lobby'&&d.dataset.walking==='true'};}));
    await closeDoor(mobileLobbyPose,'mobile-lobby');
    const mobileRoomPose = await openDoor('office-0', 'office', 0);
    check('Mobile room controls fit the viewport', await page.evaluate(() => {
      const d = document.querySelector('.rp-showroom');
      const rects = [...d.querySelectorAll('[data-stick], [data-close], [data-room-spot]')].map(el => {
        const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, right: r.right, bottom: r.bottom};
      });
      return {pass: rects.every(r => r.x >= -.1 && r.y >= -.1 && r.right <= innerWidth + .1 && r.bottom <= innerHeight + .1), rects};
    }));
    await page.screenshot({path: out + '/mobile-office.png'});
    await closeDoor(mobileRoomPose, 'mobile-office');
    await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1, hasTouch: true});

    await exerciseApartmentCatalog();

    check('No WebGL or local resource errors', await page.evaluate((errors, bad) => ({pass: errors.length === 0 && bad.length === 0 && window.__rp.renderer.getContext().getError() === 0, errors, bad}), errors, bad));
    await openActivity(reactionId, 'reaction'); await page.click(game + ' [data-start]');
    check('Disposing a tour removes a pending game and its HUD', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI, hud = tour.hud, dialog = tour.activities.dialog, gardenDialog = tour.gardenControls.dialog;
      tour.dispose(); return {pass: !hud.isConnected && !dialog.isConnected && !dialog.open && !gardenDialog.isConnected && !gardenDialog.open,
        hudConnected: hud.isConnected, dialogConnected: dialog.isConnected, dialogOpen: dialog.open, gardenDialogConnected: gardenDialog.isConnected};
    }));
    await sleep(2600);
    check('Disposed activity stays absent after its scheduled signal time', {pass: await page.evaluate(() => !document.querySelector('#cluster-map .courtyard-activity') && !document.querySelector('#cluster-map .tour-hud') && !document.querySelector('#cluster-map .rp-garden-controls'))});
    }
  } catch (error) {
    errors.push(error.stack); process.exitCode = 1;
    await page.screenshot({path: out + '/interaction-failure.png'}).catch(() => {});
  } finally {
    const minimumChecks = pointerOnly?6:149+apartmentExpectedChecks;
    const result = {revision:37,publication:"37.1.0",base, pointerOnly, limitations:[{path:'native Mac select-popup keyboard via headless CDP',verified:false,evidence:'trusted Home/ArrowDown/Enter targeted SELECT with defaultPrevented=false and tour enabled; selected value stayed unchanged; disabled-attribute mutations 0; pointer/touch plus onchange and real action path separately verified'}], minimumChecks, apartmentExpectedChecks, actualChecks: checks.length, checks, errors, bad, pass: checks.length >= minimumChecks && checks.every(c => c.pass) && errors.length === 0 && bad.length === 0};
    fs.writeFileSync(out + (pointerOnly?'/interaction-pointer.json':'/interaction.json'), JSON.stringify(result, null, 2));
    await browser.close();
    if (!result.pass) process.exitCode = 1;
  }
})().catch(error => {console.error(error.stack); process.exitCode = 1;});
