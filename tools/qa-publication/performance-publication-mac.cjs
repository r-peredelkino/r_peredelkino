// Two paired Apple Silicon measurements of the same v37 scene, before and
// after the public packaging / Three.js upgrade. This is not a model revision
// or a promised speedup. Run after the functional native browser checks.
const fs = require('node:fs');
const puppeteer = require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const out = process.env.RP_QA_OUT || '/tmp/rodina-qa-publication';
const sourceURL = process.env.RP_QA_BEFORE_URL || 'http://127.0.0.1:8080';
const publicURL = process.env.RP_QA_URL || 'http://127.0.0.1:8098/r_peredelkino/';
const variants = [
  {id: 'source-v37', base: sourceURL, modelRelease: 37, publicationVersion: null, threeRevision: 170,
    renderInfoScope: 'r170 resets renderer.info after shadowMap.render; reported counters exclude shadow passes.'},
  {id: 'public-37.1.0', base: publicURL, modelRelease: 37, publicationVersion: '37.1.0', threeRevision: 186,
    renderInfoScope: 'r186 resets renderer.info before shadowMap.render; reported counters include shadow passes.'}
];
const frameCount = 90;
const views = [['courtyard', null], ['forecourt', null], ['facade', 0]];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const entryURL = base => new URL('index.html?view=genplan', base.replace(/\/?$/, '/')).href;

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await puppeteer.launch({headless: true,
    executablePath: '/tmp/rodina-reference-qa-v26/chrome-arm64',
    userDataDir: out + '/performance-publication-native',
    args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update']});
  const page = await browser.newPage();
  await page.setViewport({width: 1500, height: 1000, deviceScaleFactor: 1});
  await page.setCacheEnabled(false);
  page.setDefaultTimeout(90000);
  let current = null;
  const report = {modelRelease: 37, publicationVersion: '37.1.0', nodeArchitecture: process.arch,
    variants, samples: [], errors: [], consoleErrors: [], shaderConsoleErrors: [], resources: [],
    method: {viewport: [1500, 1000], dpr: 1, date: '2026-07-15', minutes: 720,
      quality: 'full', renderArea: [1500, 1000], pairedRepeats: 2, framesPerView: frameCount,
      order: ['source-v37', 'public-37.1.0', 'source-v37', 'public-37.1.0'],
      countsIncludeShadowDifference: true,
      rawCountersDirectlyComparable: false,
      renderCounterNote: 'The r170 reset excludes shadow draws; the r186 reset includes them. Alternating shadow updates can increase raw calls/triangles without any added model geometry. Do not compare raw counters as a geometry or complexity budget.',
      measurement: 'requestAnimationFrame intervals; identical model release, cameras and render dimensions; no FPS guarantee',
      passDefinition: 'Pass validates complete measurements, runtime identity, camera/drawing-size parity and absence of errors; it does not establish performance parity or improvement.',
      interpretation: 'Publication/dependency comparison; frame-interval differences are observed results, while their GPU cause is not established by this benchmark.'}};
  page.on('pageerror', error => report.errors.push({context: current, message: error.message}));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const record = {context: current, text: message.text(), location: message.location()};
    report.consoleErrors.push(record);
    if (/shader|program|webgl/i.test(record.text)) report.shaderConsoleErrors.push(record);
  });
  page.on('response', response => {
    if ([sourceURL, publicURL].some(base => response.url().startsWith(base.replace(/\/$/, '') + '/')) && response.status() >= 400)
      report.resources.push({context: current, url: response.url(), status: response.status()});
  });
  try {
    for (const [pair, variant] of [[1, variants[0]], [1, variants[1]], [2, variants[0]], [2, variants[1]]]) {
      current = {pair, variant: variant.id};
      await page.goto(entryURL(variant.base), {waitUntil: 'load'});
      const identity = await page.evaluate(async () => {
        // Use the runtime's existing module URL; no extra query creates a
        // second Scene class in the self-contained r170 build.
        const T = await import('./vendor/three.module.js');
        window.__rpPerfThreeRevision = Number(T.REVISION);
        window.__rpPerfShaderErrors = [];
        const instrumented = new WeakSet(), previous = T.Scene.prototype.onBeforeRender;
        T.Scene.prototype.onBeforeRender = function(renderer, scene, camera, ...args) {
          previous?.call(this, renderer, scene, camera, ...args);
          if (!renderer.domElement.closest('#cluster-map')) return;
          window.__rp = {renderer, scene, camera};
          if (!instrumented.has(renderer)) {
            instrumented.add(renderer);
            renderer.debug.checkShaderErrors = true;
            const oldError = renderer.debug.onShaderError;
            renderer.debug.onShaderError = function(gl, program, vertex, fragment) {
              window.__rpPerfShaderErrors.push({
                programLog: gl.getProgramInfoLog(program),
                vertexLog: gl.getShaderInfoLog(vertex),
                fragmentLog: gl.getShaderInfoLog(fragment),
                linked: gl.getProgramParameter(program, gl.LINK_STATUS)
              });
              if (typeof oldError === 'function') oldError.apply(this, arguments);
            };
          }
        };
        window.setMapView?.('district');
        return {release: Number(document.documentElement.dataset.release),
          publication: document.documentElement.dataset.publication || null, threeRevision: Number(T.REVISION)};
      });
      if (identity.release !== variant.modelRelease || identity.threeRevision !== variant.threeRevision ||
          variant.publicationVersion && identity.publication !== variant.publicationVersion) {
        throw new Error('Unexpected runtime at ' + variant.base + ': ' + JSON.stringify(identity) + ', expected ' + JSON.stringify(variant));
      }
      await page.waitForFunction(() => window.__rp);
      // Fullscreen chrome, metadata badges and responsive UI cannot change the
      // physical drawing dimensions used for this controlled GPU comparison.
      await page.evaluate(() => {
        const host = document.querySelector('#cluster-map');
        Object.assign(host.style, {position: 'fixed', left: '0', top: '0', width: '1500px', height: '1000px', minHeight: '1000px', maxHeight: '1000px', zIndex: '99999'});
        host.solarEnvironment.setDate('2026-07-15', 720);
        const select = document.querySelector('select[data-quality]');
        select.value = 'full'; select.dispatchEvent(new Event('change', {bubbles: true}));
      });
      await page.waitForFunction(() => document.querySelector('.env-panel').dataset.renderQuality === 'full');
      for (const [action, building] of views) {
        current = {pair, variant: variant.id, action, building};
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
            if (intervals.length < frameCount) { requestAnimationFrame(tick); return; }
            const sorted = intervals.slice().sort((a, b) => a - b), renderer = window.__rp.renderer;
            const gl = renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
            const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
            const camera = window.__rp.camera;
            const programs = (renderer.info.programs || []).map(program => ({
              id: program.id,
              linked: program.program && gl.isProgram(program.program) ? gl.getProgramParameter(program.program, gl.LINK_STATUS) : null,
              runnable: program.diagnostics?.runnable ?? null,
              programLog: program.diagnostics?.programLog || '',
              vertexLog: program.diagnostics?.vertexShader?.log || '',
              fragmentLog: program.diagnostics?.fragmentShader?.log || ''
            }));
            resolve({frames: intervals.length, meanMS: mean(intervals), medianMS: sorted[Math.floor(sorted.length / 2)],
              p95MS: sorted[Math.floor(sorted.length * .95)], trianglesMean: mean(triangles),
              trianglesMin: Math.min(...triangles), trianglesMax: Math.max(...triangles), callsMean: mean(calls),
              glError: gl.getError(), contextLost: gl.isContextLost(),
              gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
              quality: document.querySelector('.env-panel').dataset.renderQuality,
              threeRevision: window.__rpPerfThreeRevision,
              shaderErrors: window.__rpPerfShaderErrors.slice(), programs,
              drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
              camera: {position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), zoom: camera.zoom, fov: camera.fov}});
          }
          requestAnimationFrame(tick);
        }), frameCount);
        report.samples.push({pair, variant: variant.id, version: variant.threeRevision,
          modelRelease: identity.release, publicationVersion: identity.publication,
          renderInfoScope: variant.renderInfoScope, base: variant.base, action, building, ...sample});
        const {programs, shaderErrors, ...consoleSample} = report.samples.at(-1);
        console.log(JSON.stringify({...consoleSample, programs: programs.length, shaderErrors: shaderErrors.length}));
      }
    }
  } catch (error) {
    report.errors.push({context: current, message: error.stack});
  } finally {
    report.cameraPairs = [1, 2].flatMap(pair => views.map(([action]) => {
      const a = report.samples.find(s => s.pair === pair && s.variant === 'source-v37' && s.action === action);
      const b = report.samples.find(s => s.pair === pair && s.variant === 'public-37.1.0' && s.action === action);
      if (!a || !b) return {pair, action, pass: false, missing: true};
      const positionError = Math.hypot(...a.camera.position.map((v, i) => v - b.camera.position[i]));
      const rotationError = Math.min(Math.hypot(...a.camera.quaternion.map((v, i) => v - b.camera.quaternion[i])),
        Math.hypot(...a.camera.quaternion.map((v, i) => v + b.camera.quaternion[i])));
      return {pair, action, pass: positionError < 1e-5 && rotationError < 1e-5 && a.camera.zoom === b.camera.zoom && a.camera.fov === b.camera.fov && JSON.stringify(a.drawingBuffer) === JSON.stringify(b.drawingBuffer),
        drawingBuffers: [a.drawingBuffer, b.drawingBuffer], positionError, rotationError, sourceZoom: a.camera.zoom, publicZoom: b.camera.zoom};
    }));
    report.pass = process.arch === 'arm64' && report.samples.length === 12 && report.cameraPairs.every(p => p.pass) &&
      report.errors.length === 0 && report.consoleErrors.length === 0 && report.resources.length === 0 &&
      report.samples.every(s => s.frames === frameCount && s.modelRelease === 37 &&
        s.version === (s.variant === 'source-v37' ? 170 : 186) && s.threeRevision === s.version &&
        s.quality === 'full' && s.glError === 0 && !s.contextLost && s.shaderErrors.length === 0 &&
        s.programs.length > 0 && s.programs.every(program => program.linked === true && program.runnable !== false) &&
        s.drawingBuffer[0] === 1500 && s.drawingBuffer[1] === 1000 && Number.isFinite(s.meanMS) && s.meanMS > 0 &&
        Number.isFinite(s.trianglesMean) && s.trianglesMean > 0 && Number.isFinite(s.callsMean) && s.callsMean > 0);
    const summary = {modelRelease: 37, publicationVersion: '37.1.0',
      method: {...report.method, nodeArchitecture: process.arch, gpu: [...new Set(report.samples.map(s => s.gpu))]},
      cameraPairs: report.cameraPairs, errors: report.errors, consoleErrors: report.consoleErrors,
      shaderConsoleErrors: report.shaderConsoleErrors, resources: report.resources, pass: report.pass};
    const mean = (samples, key) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    for (const [action] of views) {
      const source = report.samples.filter(s => s.variant === 'source-v37' && s.action === action);
      const published = report.samples.filter(s => s.variant === 'public-37.1.0' && s.action === action);
      if (source.length !== 2 || published.length !== 2) continue;
      const sourceMS = mean(source, 'meanMS'), publicMS = mean(published, 'meanMS');
      summary[action] = {sourceMeanMS: sourceMS, publicMeanMS: publicMS,
        frameTimeChangePercent: (publicMS - sourceMS) / sourceMS * 100,
        percentConvention: 'Positive means a longer frame interval; negative means a shorter interval. No speedup claim.',
        rawCountersDirectlyComparable: false,
        sourceRenderInfoScope: variants[0].renderInfoScope,
        publicRenderInfoScope: variants[1].renderInfoScope,
        sourceTriangles: mean(source, 'trianglesMean'), publicTriangles: mean(published, 'trianglesMean'),
        sourceDrawCalls: mean(source, 'callsMean'), publicDrawCalls: mean(published, 'callsMean'),
        pairedChangesPercent: [1, 2].map(pair => {
          const a = source.find(s => s.pair === pair).meanMS, b = published.find(s => s.pair === pair).meanMS;
          return (b - a) / a * 100;
        })};
    }
    fs.writeFileSync(out + '/performance-publication-paired.json', JSON.stringify(report, null, 2));
    fs.writeFileSync(out + '/performance-publication-summary.json', JSON.stringify(summary, null, 2));
    await browser.close();
    if (!report.pass) process.exitCode = 1;
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
