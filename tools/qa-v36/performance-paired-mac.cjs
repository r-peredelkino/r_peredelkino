// Two paired native Apple Silicon measurements, same cameras and full quality.
const fs = require('node:fs');
const puppeteer = require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const out = process.env.RP_QA_OUT || '/tmp/rodina-qa-v36';
const before = process.env.RP_QA_BEFORE_URL || 'http://127.0.0.1:8080';
const after = process.env.RP_QA_URL || 'http://127.0.0.1:8096';
const frameCount = 90;
const views = [['courtyard', null], ['forecourt', null], ['facade', 0]];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await puppeteer.launch({headless: true,
    executablePath: '/tmp/rodina-reference-qa-v26/chrome-arm64',
    userDataDir: out + '/performance-native',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update']});
  const page = await browser.newPage();
  await page.setViewport({width: 1500, height: 1000, deviceScaleFactor: 1});
  page.setDefaultTimeout(90000);
  const report = {nodeArchitecture: process.arch, samples: [], errors: [], resources: [],
    method: {viewport: [1500, 1000], dpr: 1, date: '2026-07-15', minutes: 720,
      quality: 'full', pairedRepeats: 2, framesPerView: frameCount,
      order: [35, 36, 35, 36], measurement: 'requestAnimationFrame intervals; controlled comparison, no FPS guarantee'}};
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {
    if ([before, after].some(base => response.url().startsWith(base)) && response.status() >= 400)
      report.resources.push({url: response.url(), status: response.status()});
  });
  try {
    for (const [pair, version, base] of [[1, 35, before], [1, 36, after], [2, 35, before], [2, 36, after]]) {
      await page.goto(base + '/index.html?view=genplan', {waitUntil: 'load'});
      await page.evaluate(async () => {
        const T = await import('./vendor/three.module.js');
        const previous = T.Scene.prototype.onBeforeRender;
        T.Scene.prototype.onBeforeRender = function(renderer, scene, camera, ...args) {
          previous?.call(this, renderer, scene, camera, ...args);
          if (renderer.domElement.closest('#cluster-map')) window.__rp = {renderer, scene, camera};
        };
        window.setMapView('district');
      });
      await page.waitForFunction(() => window.__rp);
      const actualRelease = await page.evaluate(() => Number(document.documentElement.dataset.release));
      if (actualRelease !== version) throw new Error('Unexpected release at ' + base + ': ' + actualRelease + ', expected ' + version);
      await page.evaluate(() => {
        document.querySelector('#cluster-map').solarEnvironment.setDate('2026-07-15', 720);
        const select = document.querySelector('select[data-quality]');
        select.value = 'full'; select.dispatchEvent(new Event('change', {bubbles: true}));
      });
      await page.waitForFunction(() => document.querySelector('.env-panel').dataset.renderQuality === 'full');
      for (const [action, building] of views) {
        await page.evaluate(([action, building]) => window.clusterCamera(action, building), [action, building]);
        await sleep(2500);
        const sample = await page.evaluate(frameCount => new Promise(resolve => {
          const intervals = [], triangles = [], calls = [];
          let previous = null;
          function tick(time) {
            if (previous !== null) {
              intervals.push(time - previous);
              triangles.push(window.__rp.renderer.info.render.triangles);
              calls.push(window.__rp.renderer.info.render.calls);
            }
            previous = time;
            if (intervals.length < frameCount) {requestAnimationFrame(tick); return;}
            const sorted = intervals.slice().sort((a, b) => a - b), renderer = window.__rp.renderer;
            const gl = renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
            const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
            const camera = window.__rp.camera;
            resolve({frames: intervals.length, meanMS: mean(intervals), medianMS: sorted[Math.floor(sorted.length / 2)],
              p95MS: sorted[Math.floor(sorted.length * .95)], trianglesMean: mean(triangles),
              trianglesMin: Math.min(...triangles), trianglesMax: Math.max(...triangles), callsMean: mean(calls),
              glError: gl.getError(), gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
              quality: document.querySelector('.env-panel').dataset.renderQuality,
              camera: {position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom, fov: camera.fov}});
          }
          requestAnimationFrame(tick);
        }), frameCount);
        report.samples.push({pair, version, base, action, building, ...sample});
        console.log(JSON.stringify(report.samples.at(-1)));
      }
    }
  } catch (error) {
    report.errors.push(error.stack);
  } finally {
    report.cameraPairs = [1, 2].flatMap(pair => views.map(([action]) => {
      const a = report.samples.find(s => s.pair === pair && s.version === 35 && s.action === action);
      const b = report.samples.find(s => s.pair === pair && s.version === 36 && s.action === action);
      if (!a || !b) return {pair, action, pass: false, missing: true};
      const positionError = Math.hypot(...a.camera.position.map((v, i) => v - b.camera.position[i]));
      const rotationError = Math.min(Math.hypot(...a.camera.quaternion.map((v, i) => v - b.camera.quaternion[i])),
        Math.hypot(...a.camera.quaternion.map((v, i) => v + b.camera.quaternion[i])));
      return {pair, action, pass: positionError < 1e-5 && rotationError < 1e-5 && a.camera.zoom === b.camera.zoom && a.camera.fov === b.camera.fov,
        positionError, rotationError, beforeZoom: a.camera.zoom, afterZoom: b.camera.zoom};
    }));
    report.pass = process.arch === 'arm64' && report.samples.length === 12 && report.cameraPairs.every(p => p.pass) && report.errors.length === 0 && report.resources.length === 0 &&
      report.samples.every(s => s.frames === frameCount && s.quality === 'full' && s.glError === 0 && Number.isFinite(s.meanMS) && s.meanMS > 0 &&
        Number.isFinite(s.trianglesMean) && Number.isFinite(s.callsMean));
    const summary = {method: {...report.method, nodeArchitecture: process.arch, gpu: [...new Set(report.samples.map(s => s.gpu))]}, cameraPairs: report.cameraPairs, pass: report.pass};
    const mean = (samples, key) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    for (const [action] of views) {
      const oldSamples = report.samples.filter(s => s.version === 35 && s.action === action);
      const newSamples = report.samples.filter(s => s.version === 36 && s.action === action);
      if (oldSamples.length !== 2 || newSamples.length !== 2) continue;
      const beforeMS = mean(oldSamples, 'meanMS'), afterMS = mean(newSamples, 'meanMS');
      summary[action] = {beforeMeanMS: beforeMS, afterMeanMS: afterMS,
        frameTimeReductionPercent: (beforeMS - afterMS) / beforeMS * 100,
        beforeTriangles: mean(oldSamples, 'trianglesMean'), afterTriangles: mean(newSamples, 'trianglesMean'),
        beforeDrawCalls: mean(oldSamples, 'callsMean'), afterDrawCalls: mean(newSamples, 'callsMean'),
        pairedChangesPercent: [1, 2].map(pair => {
          const a = oldSamples.find(s => s.pair === pair).meanMS, b = newSamples.find(s => s.pair === pair).meanMS;
          return (a - b) / a * 100;
        })};
    }
    fs.writeFileSync(out + '/performance-paired.json', JSON.stringify(report, null, 2));
    fs.writeFileSync(out + '/performance-summary.json', JSON.stringify(summary, null, 2));
    await browser.close();
    if (!report.pass) process.exitCode = 1;
  }
})().catch(error => {console.error(error.stack); process.exitCode = 1;});
