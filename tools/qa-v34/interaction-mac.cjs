// Native Apple Silicon UI acceptance. Only QA outputs/profile live under /tmp.
// Uses real keyboard events and real game timers; does not replace model state.
const fs = require('node:fs');
const puppeteer = require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const base = process.env.RP_QA_URL || 'http://127.0.0.1:8094';
const out = process.env.RP_QA_OUT || '/tmp/rodina-qa-v34';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const host = '#cluster-map';
const game = 'dialog.courtyard-activity[open]';
const room = 'dialog.rp-showroom[open]';

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/tmp/rodina-reference-qa-v26/chrome-arm64',
    userDataDir: out + '/interaction-browser',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  // Enable touch from the initial navigation: changing hasTouch midway would
  // reload Chrome and discard the exact exterior continuation being tested.
  await page.setViewport({width: 1440, height: 1000, deviceScaleFactor: 1, hasTouch: true});
  const errors = [], bad = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
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
    await page.click(room + ' [data-close]');
    await page.waitForFunction(() => !document.querySelector('.rp-showroom'));
    await sleep(180);
    await comparePose(id + ' close restores exterior position and rotation', before);
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

  try {
    await page.goto(base + '/index.html?view=genplan', {waitUntil: 'load'});
    await page.evaluate(async () => {
      const T = await import('./vendor/three.module.js');
      const prior = T.Scene.prototype.onBeforeRender;
      T.Scene.prototype.onBeforeRender = function(renderer, scene, camera, ...args) {
        prior?.call(this, renderer, scene, camera, ...args);
        if (renderer.domElement.closest('#cluster-map')) window.__rp = {renderer, scene, camera};
      };
      window.setMapView('district');
    });
    await page.waitForFunction(() => window.__rp && document.querySelector('#cluster-map')?.tourAPI);
    check('Release 34', {pass: await page.evaluate(() => document.documentElement.dataset.release === '34')});
    await page.evaluate(() => document.querySelector('#cluster-map').solarEnvironment?.setDate('2026-07-15', 720));
    await page.click('#cluster-walk');
    await page.waitForFunction(() => !document.querySelector('#cluster-map .tour-hud').hidden);

    const ids = await page.evaluate(() => document.querySelector('#cluster-map').tourAPI.interactions.map(i => i.id));
    const doors = ['lobby-1', 'lobby-2', 'lobby-3', 'lobby-4', 'lobby-5', 'office-0', 'arena-entry', 'retail-1', 'retail-2', 'retail-3', 'sales-office'];
    check('Every section and commercial entrance is discoverable', {pass: doors.every(id => ids.includes(id)), ids});
    check('All exterior interaction approach points are safe', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI;
      const bad = tour.interactions.filter(i => !i.point || !tour.world.free(...i.point)).map(i => i.id);
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
        await page.select(room + ' [data-room-spot]', 'lift');
        const liftButtons = await page.$$eval('.rp-showroom [data-guide-actions] button', buttons => buttons.map(b => b.textContent));
        check('First lobby lift offers floor 2 and floor 30', {pass: liftButtons.some(t => t.startsWith('2 этаж')) && liftButtons.some(t => t.startsWith('30 этаж')), buttons: liftButtons});
        await page.evaluate(() => [...document.querySelectorAll('.rp-showroom [data-guide-actions] button')].find(b => b.textContent.startsWith('30 этаж')).click());
        await page.waitForFunction(() => document.querySelector('.rp-showroom')?.dataset.kind === 'floor30' && document.querySelector('.rp-showroom')?.userData?.height > 80);
        check('Lobby elevator opens the actual 30th-floor showroom', {pass: true});
        await page.click(room + ' [data-lobby]');
        await page.waitForFunction(() => document.querySelector('.rp-showroom')?.dataset.kind === 'lobby' && !!document.querySelector('.rp-showroom')?.userData?.renderer);
        check('Elevator returns to first lobby without losing exterior continuation', {pass: true});
      }
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

    check('No WebGL or local resource errors', await page.evaluate((errors, bad) => ({pass: errors.length === 0 && bad.length === 0 && window.__rp.renderer.getContext().getError() === 0, errors, bad}), errors, bad));
    await openActivity(reactionId, 'reaction'); await page.click(game + ' [data-start]');
    check('Disposing a tour removes a pending game and its HUD', await page.evaluate(() => {
      const tour = document.querySelector('#cluster-map').tourAPI, hud = tour.hud, dialog = tour.activities.dialog;
      tour.dispose(); return {pass: !hud.isConnected && !dialog.isConnected && !dialog.open,
        hudConnected: hud.isConnected, dialogConnected: dialog.isConnected, dialogOpen: dialog.open};
    }));
    await sleep(2600);
    check('Disposed activity stays absent after its scheduled signal time', {pass: await page.evaluate(() => !document.querySelector('#cluster-map .courtyard-activity') && !document.querySelector('#cluster-map .tour-hud'))});
  } catch (error) {
    errors.push(error.stack); process.exitCode = 1;
    await page.screenshot({path: out + '/interaction-failure.png'}).catch(() => {});
  } finally {
    const expectedChecks = 65;
    const result = {base, expectedChecks, checks, errors, bad, pass: checks.length === expectedChecks && checks.every(c => c.pass) && errors.length === 0 && bad.length === 0};
    fs.writeFileSync(out + '/interaction.json', JSON.stringify(result, null, 2));
    await browser.close();
    if (!result.pass) process.exitCode = 1;
  }
})().catch(error => {console.error(error.stack); process.exitCode = 1;});
