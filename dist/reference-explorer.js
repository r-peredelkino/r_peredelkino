// Original developer imagery: a separate, explicitly labelled panoramic mode.
// The JPEG tiles remain byte-for-byte identical to the published source.
import * as THREE from './vendor/three.module.js';
import {referenceExplorerData as DATA} from './reference-explorer-data.js?v=community38';

const RAD = Math.PI / 180;
const DEGREES = 180 / Math.PI;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const normalPan = n => ((n + 180) % 360 + 360) % 360 - 180;
const imageRoot = new URL('./assets/panorama/', import.meta.url);
const sourceURL = DATA.source.url;
const sceneById = new Map(DATA.scenes.map(scene => [scene.id, scene]));
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The source's front is +Z; Three's default camera looks toward -Z.
// u and v are source-image coordinates in [-1,1], v increasing downwards.
export function referenceCubeDirection(face, u, v) {
  return [[u,-v,-1],[1,-v,u],[-u,-v,1],[-1,-v,-u],[u,1,-v],[u,-1,v]][face];
}

export function referenceDirectionFromAngles(pan, tilt) {
  const p = pan * RAD, t = tilt * RAD;
  return [-Math.sin(p) * Math.cos(t), Math.sin(t), -Math.cos(p) * Math.cos(t)];
}

export function referenceTileURL(nodeId, face, level, col = 0, row = 0) {
  if (!sceneById.has(nodeId) || !Number.isInteger(face) || face < 0 || face > 5 ||
      ![0,3].includes(level) || !Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0 || col > 6 || row > 6) {
    throw new Error('Неизвестный фрагмент панорамы');
  }
  return new URL(`tiles/${nodeId}/cf_${face}/l_${level}/c_${col}/tile_${row}.jpg`, imageRoot).href;
}

function tileGeometry(face, left, top, right, bottom, imageWidth, imageHeight, visibleWidth, visibleHeight, overlap, radius) {
  const corners = [[left,top],[right,top],[right,bottom],[left,bottom]];
  const positions = corners.flatMap(([u,v]) => referenceCubeDirection(face, u * 2 - 1, v * 2 - 1).map(n => n * radius));
  const u0 = overlap / imageWidth, u1 = (overlap + visibleWidth) / imageWidth;
  const v0 = 1 - overlap / imageHeight, v1 = 1 - (overlap + visibleHeight) / imageHeight;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u0,v0,u1,v0,u1,v1,u0,v1], 2));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.computeBoundingSphere();
  return geometry;
}

async function imageBitmap(url, signal) {
  const response = await fetch(url, {signal, cache:'force-cache'});
  if (!response.ok) throw new Error(`Изображение недоступно (${response.status})`);
  const blob = await response.blob();
  // Bitmap texture upload ignores texture.flipY. Flip once at decode, never the JPEG.
  return createImageBitmap(blob, {imageOrientation:'flipY', premultiplyAlpha:'none', colorSpaceConversion:'default'});
}

function sourceTexture(bitmap) {
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function imageMesh(geometry, bitmap, renderOrder) {
  const texture = sourceTexture(bitmap);
  const material = new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide, toneMapped:false, depthTest:false, depthWrite:false});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = renderOrder;
  return mesh;
}

function disposeMesh(mesh) {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  const texture = mesh.material.map;
  texture?.dispose();
  texture?.image?.close?.();
  mesh.material.dispose();
}

function ensureStyle() {
  if (document.querySelector('link[data-reference-explorer-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./reference-explorer.css?v=community38', import.meta.url).href;
  link.dataset.referenceExplorerStyle = '';
  document.head.append(link);
}

/**
 * Separate original-panorama viewer. It never moves the existing 3D camera.
 * onOpenBuilding(id) is called from the original developer's building hit areas.
 * Call destroy() when a parent closes the overlay without using its close button.
 */
export function createReferenceExplorer({host = document.body, onClose = () => {}, onOpenBuilding = () => {}, initialArea = 'forecourt'} = {}) {
  ensureStyle();
  const oldFocus = document.activeElement;
  const layer = document.createElement('section');
  layer.className = 'reference-explorer';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', 'Оригинальные панорамы застройщика');
  layer.dataset.referenceExplorer = '30';
  layer.innerHTML = `
    <div class="rx-stage" aria-label="Панорама. Перетаскивайте, чтобы осмотреться, используйте колесо для приближения" tabindex="0"></div>
    <div class="rx-pins" aria-label="Объекты панорамы"></div>
    <header class="rx-header">
      <div class="rx-brand"><span class="rx-wordmark">РОДИНА <i>ПЕРЕДЕЛКИНО</i></span><h2>Оригинал застройщика</h2><p>Панорамные точки · исходные изображения</p></div>
      <button type="button" class="rx-close" data-action="close" aria-label="Закрыть панораму и вернуться к интерактивной карте"><span aria-hidden="true">←</span> К карте</button>
    </header>
    <nav class="rx-areas" aria-label="Посмотреть территорию">${DATA.areas.map(area => `<button type="button" data-area="${area.id}" aria-pressed="false">${escapeHTML(area.label)}</button>`).join('')}<button type="button" data-action="plan" aria-expanded="false">Генплан <span aria-hidden="true">↗</span></button></nav>
    <div class="rx-state-switch" role="group" aria-label="Состояние проекта"><button type="button" data-state="after" aria-pressed="true">Проект</button><button type="button" data-state="before" aria-pressed="false" title="Исходная съёмка без проектной визуализации">Съёмка</button></div>
    <div class="rx-loader" role="status"><span class="rx-loader-dot"></span><span>Загружаю панораму…</span></div>
    <div class="rx-source-state" aria-live="polite"></div>
    <aside class="rx-info" hidden><button type="button" data-action="info-close" class="rx-icon" aria-label="Закрыть описание">×</button><strong></strong><p></p></aside>
    <section class="rx-plan" aria-label="Оригинальный генплан" hidden><header><div><small>Из материалов застройщика</small><h3>Выберите корпус</h3></div><button type="button" data-action="plan-close" class="rx-icon" aria-label="Закрыть генплан">×</button></header><div class="rx-plan-content"></div></section>
    <footer class="rx-footer">
      <div class="rx-scenes" role="group" aria-label="Панорамная точка">
        ${['node1','node2','node3'].map(id => {const scene = sceneById.get(id); return `<button type="button" data-scene="${id}" aria-pressed="false"><img src="${referenceTileURL(id,0,0)}" alt="" loading="lazy"><span>${escapeHTML(scene.label)}</span></button>`;}).join('')}
      </div>
      <div class="rx-footer-text"><p>Осматривайтесь и приближайте из выбранной точки.<br><span>Свободная прогулка доступна в 3D-карте.</span></p><a href="${sourceURL}" target="_blank" rel="noopener noreferrer">Исходный тур · 29.06.2026 ↗</a></div>
      <div class="rx-controls" role="group" aria-label="Управление видом"><button type="button" class="rx-icon" data-action="zoom-in" aria-label="Приблизить">+</button><button type="button" class="rx-icon" data-action="zoom-out" aria-label="Отдалить">−</button><button type="button" class="rx-icon" data-action="reset" aria-label="Вернуть исходный ракурс">↺</button><button type="button" class="rx-label-toggle" data-action="labels" aria-pressed="true">Метки</button></div>
    </footer>`;
  host.append(layer);

  const stage = layer.querySelector('.rx-stage');
  const pinsLayer = layer.querySelector('.rx-pins');
  const loader = layer.querySelector('.rx-loader');
  const status = layer.querySelector('.rx-source-state');
  const info = layer.querySelector('.rx-info');
  const plan = layer.querySelector('.rx-plan');
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x101820, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement);
  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .05, 30);
  camera.rotation.order = 'YXZ';
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  const forward = new THREE.Vector3();
  const temporary = new THREE.Vector3();
  const view = {pan:45, tilt:-34, fov:54};
  const pointers = new Map();
  let disposed = false, current = null, sequence = 0, raf = 0, width = 1, height = 1;
  let selectedArea = initialArea, labelsVisible = true, pins = [], gesture = null, planData = null;
  let lastTileCheck = '', layoutObserver;
  const stats = {requests:0, loaded:0, errors:0, maxResidentTiles:0, originalPixels:true};

  // Readiness belongs to the current camera, not merely to the current panorama.
  // An API caller can change the view and await it before the next animation frame.
  function tileCheckKey() {
    return current ? [current.token, view.pan, view.tilt, view.fov, width, height].join(':') : '';
  }

  function detailsReady() {
    return !!current?.previewReady && !!current.ready && current.demandKey === tileCheckKey();
  }

  function askDraw() {
    if (disposed || raf) return;
    if (current?.previewReady && !detailsReady()) layer.dataset.ready = 'preview';
    raf = requestAnimationFrame(draw);
  }

  function updateCamera() {
    const aspect = width / height;
    const verticalFov = Math.min(95, 2 * Math.atan(Math.tan(view.fov * RAD / 2) / aspect) * DEGREES);
    camera.aspect = aspect;
    camera.fov = verticalFov;
    camera.rotation.set(view.tilt * RAD, view.pan * RAD, 0, 'YXZ');
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(forward);
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    lastTileCheck = '';
    askDraw();
  }

  function makeTiles(source) {
    const count = Math.ceil(source.size / source.tileSize), descriptors = [];
    for (let face = 0; face < 6; face++) for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      const left = col * source.tileSize, top = row * source.tileSize;
      const visibleWidth = Math.min(source.tileSize, source.size - left);
      const visibleHeight = Math.min(source.tileSize, source.size - top);
      const corners = [[left,top],[left+visibleWidth,top],[left+visibleWidth,top+visibleHeight],[left,top+visibleHeight]]
        .map(([u,v]) => new THREE.Vector3(...referenceCubeDirection(face, u/source.size*2-1, v/source.size*2-1)).multiplyScalar(9.99));
      const centre = new THREE.Vector3().addVectors(corners[0],corners[2]).multiplyScalar(.5);
      const sphere = new THREE.Sphere(centre, Math.max(...corners.map(point => point.distanceTo(centre))) * 1.015);
      descriptors.push({key:`${face}:${col}:${row}`, face, col, row, left, top, visibleWidth, visibleHeight, centre:centre.clone().normalize(), sphere});
    }
    return descriptors;
  }

  function disposeScene(scene) {
    if (!scene) return;
    scene.abort.abort();
    for (const mesh of scene.previews) disposeMesh(mesh);
    for (const entry of scene.loaded.values()) disposeMesh(entry.mesh);
    scene.previews.length = 0;
    scene.loaded.clear();
    scene.queue.length = 0;
  }

  function refreshControls() {
    if (!current) return;
    const source = current.source, groupId = source.before ? source.counterpart : source.id;
    layer.dataset.scene = source.id;
    layer.dataset.state = source.before ? 'before' : 'after';
    layer.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === groupId)));
    layer.querySelectorAll('[data-state]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.state === 'before') === source.before)));
    layer.querySelectorAll('[data-area]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.area === selectedArea)));
    status.textContent = source.before ? 'Съёмка участка · исходная панорама' : `${source.lighting === 'evening' ? 'Вечерний' : 'Дневной'} проектный вид`;
  }

  function showInfo(title, description) {
    info.querySelector('strong').textContent = title;
    info.querySelector('p').textContent = description;
    info.hidden = false;
  }

  function makePins(source) {
    pinsLayer.replaceChildren();
    pins = [];
    const canonical = source.before ? source.counterpart : source.id;
    const customNode = canonical === 'node2' ? 'node1' : canonical;
    const custom = source.before ? [] : DATA.customPois.filter(poi => poi.node === customNode);
    const original = source.originalHotspots.filter(poi => poi.skinid === 'metro' || (canonical === 'node3' && ['Ульяновский лесопарк','Детский парк "Буратино"'].includes(poi.title)))
      .map(poi => ({id:poi.id, label:poi.title, pan:Number(poi.pan), tilt:Number(poi.tilt), description:'Положение этой метки сохранено из опубликованного тура застройщика.', placementSource:'published-xml'}));
    for (const poi of [...custom, ...original]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rx-pin';
      button.dataset.poi = poi.id;
      button.setAttribute('aria-label', poi.label);
      button.title = poi.label;
      const dot = document.createElement('span'); dot.className = 'rx-pin-dot'; dot.textContent = poi.label.startsWith('Метро') ? 'М' : '+';
      const caption = document.createElement('span'); caption.className = 'rx-pin-caption'; caption.textContent = poi.label;
      button.append(dot, caption);
      button.addEventListener('click', () => showInfo(poi.label, poi.description));
      pinsLayer.append(button);
      pins.push({element:button, point:new THREE.Vector3(...referenceDirectionFromAngles(poi.pan, poi.tilt)).multiplyScalar(8)});
    }
    askDraw();
  }

  function updatePins() {
    for (const pin of pins) {
      temporary.copy(pin.point).project(camera);
      const visible = labelsVisible && temporary.z >= -1 && temporary.z <= 1 && Math.abs(temporary.x) < .98 && Math.abs(temporary.y) < .96;
      pin.element.hidden = !visible;
      if (visible) pin.element.style.transform = `translate(${(temporary.x+1)*width/2}px,${(1-temporary.y)*height/2}px) translate(-50%,-50%)`;
    }
  }

  async function openNode(id, {preserveView = false, area = null} = {}) {
    const source = sceneById.get(id);
    if (!source || disposed) return;
    if (area) selectedArea = area;
    if (!preserveView) {
      const preset = DATA.areas.find(item => item.id === (area || source.area));
      Object.assign(view, {pan:preset.pan, tilt:preset.tilt, fov:preset.fov});
    }
    if (current?.source.id === id && current.previewReady) { refreshControls(); askDraw(); return; }
    disposeScene(current);
    const scene = current = {source, token:++sequence, abort:new AbortController(), previews:[], previewReady:false, loaded:new Map(), pending:new Set(), failed:new Map(), descriptors:makeTiles(source), queue:[], active:0, wanted:new Set(), desired:[], ready:false, demandKey:''};
    layer.dataset.ready = 'false';
    loader.hidden = false;
    loader.innerHTML = '<span class="rx-loader-dot"></span><span>Загружаю панораму…</span>';
    info.hidden = true;
    refreshControls();
    makePins(source);
    lastTileCheck = '';
    askDraw();
    try {
      await Promise.all(Array.from({length:6}, async (_, face) => {
        const bitmap = await imageBitmap(referenceTileURL(id,face,0), scene.abort.signal);
        if (disposed || current !== scene) { bitmap.close(); return; }
        const geometry = tileGeometry(face,0,0,1,1,bitmap.width,bitmap.height,source.previewSize,source.previewSize,source.overlap,10);
        const mesh = imageMesh(geometry, bitmap, 0);
        world.add(mesh); scene.previews.push(mesh);
        askDraw();
      }));
      if (disposed || current !== scene) return;
      scene.previewReady = true;
      loader.hidden = true;
      layer.dataset.ready = 'preview';
      lastTileCheck = '';
      askDraw();
    } catch (error) {
      if (error.name === 'AbortError' || disposed || current !== scene) return;
      loader.hidden = false;
      loader.innerHTML = '<span>Не удалось открыть изображения.</span><button type="button" data-action="retry">Повторить</button>';
    }
  }

  function chooseTiles() {
    const scene = current;
    if (!scene?.previewReady) return;
    const stateKey = tileCheckKey();
    if (stateKey === lastTileCheck) return;
    lastTileCheck = stateKey;
    const cap = width < 640 ? 96 : 160;
    const needed = scene.descriptors.filter(tile => frustum.intersectsSphere(tile.sphere))
      .sort((a,b) => b.centre.dot(forward) - a.centre.dot(forward)).slice(0,cap);
    scene.desired = needed;
    scene.demandKey = stateKey;
    scene.wanted = new Set(needed.map(tile => tile.key));
    const now = performance.now();
    for (const entry of scene.loaded.values()) {
      entry.mesh.visible = scene.wanted.has(entry.key);
      if (entry.mesh.visible) entry.lastUsed = now;
    }
    scene.queue = needed.filter(tile => !scene.loaded.has(tile.key) && !scene.pending.has(tile.key) && !scene.failed.has(tile.key));
    for (const entry of [...scene.loaded.values()].sort((a,b) => a.lastUsed-b.lastUsed)) {
      if (scene.loaded.size <= cap) break;
      if (!scene.wanted.has(entry.key)) { disposeMesh(entry.mesh); scene.loaded.delete(entry.key); }
    }
    scene.ready = needed.every(tile => scene.loaded.has(tile.key));
    layer.dataset.ready = detailsReady() ? 'complete' : 'preview';
    pump(scene);
  }

  function pump(scene) {
    if (disposed || scene !== current) return;
    while (scene.active < 6 && scene.queue.length) {
      const tile = scene.queue.shift();
      if (scene.loaded.has(tile.key) || scene.pending.has(tile.key) || !scene.wanted.has(tile.key)) continue;
      scene.active++; scene.pending.add(tile.key); stats.requests++;
      imageBitmap(referenceTileURL(scene.source.id,tile.face,scene.source.maxLevel,tile.col,tile.row), scene.abort.signal).then(bitmap => {
        if (disposed || scene !== current) { bitmap.close(); return; }
        const source = scene.source;
        const geometry = tileGeometry(tile.face,tile.left/source.size,tile.top/source.size,(tile.left+tile.visibleWidth)/source.size,(tile.top+tile.visibleHeight)/source.size,bitmap.width,bitmap.height,tile.visibleWidth,tile.visibleHeight,source.overlap,9.99);
        const mesh = imageMesh(geometry,bitmap,2);
        mesh.visible = scene.wanted.has(tile.key);
        mesh.userData.sourceTile = `tiles/${source.id}/cf_${tile.face}/l_${source.maxLevel}/c_${tile.col}/tile_${tile.row}.jpg`;
        world.add(mesh);
        scene.loaded.set(tile.key,{key:tile.key,mesh,lastUsed:performance.now()});
        stats.loaded++;
        stats.maxResidentTiles = Math.max(stats.maxResidentTiles,scene.loaded.size);
        scene.ready = scene.desired.every(item => scene.loaded.has(item.key));
        layer.dataset.ready = detailsReady() ? 'complete' : 'preview';
        askDraw();
      }).catch(error => {
        if (error.name === 'AbortError' || disposed || scene !== current) return;
        scene.failed.set(tile.key,error.message); stats.errors++;
        if (scene.wanted.has(tile.key)) {
          status.replaceChildren(document.createTextNode('Некоторые детали не загрузились. '));
          const retry = document.createElement('button'); retry.type = 'button'; retry.dataset.action = 'retry-tiles'; retry.textContent = 'Повторить'; status.append(retry);
        }
      }).finally(() => {
        scene.active--; scene.pending.delete(tile.key);
        if (scene === current) pump(scene);
      });
    }
  }

  function draw() {
    raf = 0;
    if (disposed) return;
    updateCamera();
    chooseTiles();
    updatePins();
    renderer.render(world,camera);
  }

  function focusArea(areaId, {preserveState = true} = {}) {
    const area = DATA.areas.find(item => item.id === areaId) || DATA.areas[0];
    selectedArea = area.id;
    const before = preserveState && current?.source.before;
    let id = area.scene;
    if (id === 'node1' && current?.source.lighting === 'evening' && preserveState) id = 'node2';
    if (before) id = sceneById.get(id).counterpart;
    Object.assign(view,{pan:area.pan,tilt:area.tilt,fov:area.fov});
    info.hidden = true;
    return openNode(id,{preserveView:true,area:area.id});
  }

  async function openPlan() {
    plan.hidden = false;
    layer.querySelector('[data-action="plan"]').setAttribute('aria-expanded','true');
    const content = plan.querySelector('.rx-plan-content');
    if (planData) return;
    content.textContent = 'Загружаю генплан…';
    try {
      const response = await fetch(new URL('./assets/reference/genplan.json',import.meta.url));
      if (!response.ok) throw new Error('Генплан недоступен');
      const data = await response.json();
      if (disposed) return;
      if (!Array.isArray(data.buildings) || data.buildings.length !== 5 || !Array.isArray(data.viewBox) || data.viewBox.length !== 4) throw new Error('Нет данных генплана');
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns,'svg');
      svg.setAttribute('viewBox',data.viewBox.join(' '));
      svg.setAttribute('role','group'); svg.setAttribute('aria-label','Выбор корпуса на исходном генплане');
      const image = document.createElementNS(ns,'image');
      image.setAttribute('href',new URL('./assets/reference/selector-new.webp',import.meta.url).href);
      image.setAttribute('width',data.viewBox[2]); image.setAttribute('height',data.viewBox[3]);
      svg.append(image);
      const list = document.createElement('div'); list.className = 'rx-plan-buildings';
      for (const building of data.buildings) {
        const id = Number(building.id);
        if (!Number.isInteger(id) || id < 1 || id > 5 || typeof building.path !== 'string' || !/^[0-9eE .,\-+MmLlHhVvCcSsQqTtAaZz]+$/.test(building.path)) throw new Error('Некорректные контуры генплана');
        const hit = document.createElementNS(ns,'path'); hit.setAttribute('d',building.path); hit.setAttribute('class','rx-plan-hit'); hit.setAttribute('role','button'); hit.setAttribute('tabindex','0'); hit.setAttribute('aria-label',`Открыть планы корпуса ${id}`);
        const activate = () => onOpenBuilding(id);
        hit.addEventListener('click',activate); hit.addEventListener('keydown',event => {if (['Enter',' '].includes(event.key)) {event.preventDefault();activate();}});
        svg.append(hit);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `Корпус ${id}`; button.addEventListener('click',activate); list.append(button);
      }
      const note = document.createElement('p'); note.textContent = 'Нажмите на корпус, чтобы перейти к нему на интерактивной карте. Контуры и изображение взяты из генплана застройщика.';
      content.replaceChildren(svg,list,note); planData = data;
    } catch (error) {
      if (disposed) return;
      content.textContent = 'Не удалось загрузить генплан. '; const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Повторить'; retry.addEventListener('click',openPlan); content.append(retry);
    }
  }

  function closePlan() { plan.hidden = true; layer.querySelector('[data-action="plan"]').setAttribute('aria-expanded','false'); }
  function adjustZoom(amount) { view.fov = clamp(view.fov+amount,28,115); askDraw(); }
  function close() { destroy(); onClose(); }

  function click(event) {
    const button = event.target.closest('button');
    if (!button || !layer.contains(button)) return;
    if (button.dataset.area) { closePlan(); focusArea(button.dataset.area); return; }
    if (button.dataset.scene) { const id = current?.source.before ? sceneById.get(button.dataset.scene).counterpart : button.dataset.scene; selectedArea = sceneById.get(id).area; openNode(id); return; }
    if (button.dataset.state) { const before = button.dataset.state === 'before'; if (current && before !== current.source.before) openNode(current.source.counterpart,{preserveView:true}); return; }
    switch (button.dataset.action) {
      case 'close': close(); break;
      case 'zoom-in': adjustZoom(-8); break;
      case 'zoom-out': adjustZoom(8); break;
      case 'reset': focusArea(selectedArea); break;
      case 'labels': labelsVisible = !labelsVisible; button.setAttribute('aria-pressed',String(labelsVisible)); askDraw(); break;
      case 'plan': plan.hidden ? openPlan() : closePlan(); break;
      case 'plan-close': closePlan(); break;
      case 'info-close': info.hidden = true; break;
      case 'retry': if (current) {current.previewReady=false;openNode(current.source.id,{preserveView:true});} break;
      case 'retry-tiles': if (current) {current.failed.clear();refreshControls();lastTileCheck='';askDraw();} break;
    }
  }

  function beginGesture() {
    const all = [...pointers.values()];
    gesture = {pan:view.pan,tilt:view.tilt,fov:view.fov,x:all[0]?.x||0,y:all[0]?.y||0,distance:all.length>1?Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y):0};
  }
  function pointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    stage.focus({preventScroll:true});
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    beginGesture(); stage.classList.add('rx-dragging');
    event.preventDefault();
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const all = [...pointers.values()];
    if (all.length > 1 && gesture.distance > 0) {
      const distance = Math.hypot(all[0].x-all[1].x,all[0].y-all[1].y);
      view.fov = clamp(2*Math.atan(Math.tan(gesture.fov*RAD/2)*gesture.distance/Math.max(1,distance))*DEGREES,28,115);
    } else {
      const effectiveHFov = 2*Math.atan(Math.tan(camera.fov*RAD/2)*camera.aspect)*DEGREES;
      view.pan = normalPan(gesture.pan+(all[0].x-gesture.x)*effectiveHFov/width);
      view.tilt = clamp(gesture.tilt+(all[0].y-gesture.y)*camera.fov/height,-88,88);
    }
    askDraw(); event.preventDefault();
  }
  function pointerUp(event) { pointers.delete(event.pointerId); if (pointers.size) beginGesture(); else {gesture=null;stage.classList.remove('rx-dragging');} }
  function wheel(event) { event.preventDefault(); adjustZoom(clamp(event.deltaY,-100,100)*.065); }
  function keydown(event) {
    // Keep the underlying free-walk controller from responding while this dialog owns input.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (!plan.hidden) closePlan(); else if (!info.hidden) info.hidden=true; else close(); return; }
    if (event.key === 'Tab') {
      const items = [...layer.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(item => !item.closest('[hidden]') && item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
      return;
    }
    if (document.activeElement !== stage || !plan.hidden) return;
    const step = event.shiftKey ? 12 : 4;
    if (event.key === 'ArrowLeft') view.pan=normalPan(view.pan+step);
    else if (event.key === 'ArrowRight') view.pan=normalPan(view.pan-step);
    else if (event.key === 'ArrowUp') view.tilt=clamp(view.tilt+step,-88,88);
    else if (event.key === 'ArrowDown') view.tilt=clamp(view.tilt-step,-88,88);
    else if (['+','='].includes(event.key)) view.fov=clamp(view.fov-8,28,115);
    else if (event.key === '-') view.fov=clamp(view.fov+8,28,115);
    else return;
    event.preventDefault(); askDraw();
  }

  function destroy() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    layoutObserver?.disconnect();
    disposeScene(current);
    current = null;
    renderer.dispose(); renderer.forceContextLoss();
    layer.remove();
    if (oldFocus?.isConnected && typeof oldFocus.focus === 'function') oldFocus.focus({preventScroll:true});
  }

  async function whenReady({details = true, timeout = 20000} = {}) {
    const start = performance.now();
    while (!disposed) {
      // Flush the camera demand synchronously; a pending RAF may still describe
      // the previous area even though focusArea()/setView() already changed view.
      updateCamera();
      chooseTiles();
      if (current?.previewReady && (!details || detailsReady())) {
        updatePins();
        renderer.render(world,camera);
        return getState();
      }
      if (performance.now()-start > timeout) throw new Error('Панорама не успела загрузить все видимые детали');
      await new Promise(resolve => setTimeout(resolve,40));
    }
    throw new Error('Панорамный режим закрыт');
  }

  function getState() {
    return {scene:current?.source.id || null, area:selectedArea, before:current?.source.before || false, view:{...view}, previewReady:!!current?.previewReady, detailsReady:detailsReady(), visibleTiles:current?.desired.length||0, residentTiles:current?.loaded.size||0, pendingTiles:current?.pending.size||0, failedTiles:current?.failed.size||0, labelsVisible, width, height, stats:{...stats}, freeMoving3D:false};
  }

  layer.addEventListener('click',click);
  layer.addEventListener('keydown',keydown);
  stage.addEventListener('pointerdown',pointerDown);
  stage.addEventListener('pointermove',pointerMove);
  stage.addEventListener('pointerup',pointerUp);
  stage.addEventListener('pointercancel',pointerUp);
  stage.addEventListener('lostpointercapture',pointerUp);
  stage.addEventListener('wheel',wheel,{passive:false});
  layoutObserver = new ResizeObserver(resize); layoutObserver.observe(stage);
  resize();
  focusArea(initialArea,{preserveState:false});
  layer.querySelector('.rx-close').focus({preventScroll:true});
  return {element:layer, openNode, focusArea, openPlan, closePlan, close, destroy, whenReady, getState,
    captureFrame({details = true} = {}) {
      if (disposed) throw new Error('Панорама закрыта');
      updateCamera(); chooseTiles();
      if (details && !detailsReady()) throw new Error('Детали текущего ракурса ещё загружаются; дождитесь whenReady()');
      renderer.render(world,camera);
      return renderer.domElement.toDataURL('image/png');
    },
    setView({pan=view.pan,tilt=view.tilt,fov=view.fov} = {}) {
      if (Number.isFinite(Number(pan))) view.pan=normalPan(Number(pan));
      if (Number.isFinite(Number(tilt))) view.tilt=clamp(Number(tilt),-88,88);
      if (Number.isFinite(Number(fov))) view.fov=clamp(Number(fov),28,115);
      askDraw();
    }};
}
