import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../dist/vendor/three.module.js';
import {createSolarExposure} from '../../dist/solar-exposure.js';
import {solarPosition, daylight, moscowDate, direction, location} from '../../dist/solar.js';

const checkResults = [];
const near = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
const check = async (name, fn) => {const details = await fn(); checkResults.push({name, status: 'PASS', ...(details ?? {})});};
const enu = (east, north, y) => new THREE.Vector3(east * location.actualEast[0] + north * location.actualNorth[0], y,
  east * location.actualEast[1] + north * location.actualNorth[1]);
const dotEN = vector => ({e: vector[0] * location.actualEast[0] + vector[2] * location.actualEast[1],
  n: vector[0] * location.actualNorth[0] + vector[2] * location.actualNorth[1], y: vector[1]});
const frameAngle = Math.atan2(-location.actualEast[1], location.actualEast[0]);
function fixtureBox({width = 20, height = 10, depth = 10, east = 0, north = 0, transparent = false} = {}) {
  const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial({transparent, opacity: transparent ? .3 : 1}));
  mesh.name = 'Analytic opaque rectangular building'; mesh.position.copy(enu(east, north, height / 2)); mesh.rotation.y = frameAngle;
  root.add(mesh); return {root, mesh, width, height, depth, east, north};
}
function destroy(root) {root.traverse(o => {o.geometry?.dispose(); o.material?.dispose();});}

// Independent interval clipping in East/North/Up for the analytic rectangular
// building, compared with the production BVH's real triangle intersections.
function analyticSunlit(point, date, box) {
  const solar = solarPosition(date);
  if (solar.apparentElevation <= 0) return false;
  const p = dotEN(point), d = dotEN(direction(solar.azimuth, solar.apparentElevation));
  const faces = [
    ['e', box.east - box.width / 2, box.east + box.width / 2],
    ['n', box.north - box.depth / 2, box.north + box.depth / 2],
    ['y', 0, box.height],
  ];
  let from = 0, to = Infinity;
  for (const [axis, minimum, maximum] of faces) {
    if (Math.abs(d[axis]) < 1e-12) {if (p[axis] < minimum || p[axis] > maximum) return true; continue;}
    const a = (minimum - p[axis]) / d[axis], b = (maximum - p[axis]) / d[axis];
    from = Math.max(from, Math.min(a, b)); to = Math.min(to, Math.max(a, b));
  }
  return to < from || to < .02;
}

await check('Winter shadow and summer clearance of a known 20×10×10 box', () => {
  const f = fixtureBox(), exposure = createSolarExposure(f), point = enu(0, 20, .5).toArray();
  const winter = exposure.sunlightAt({point, date: daylight('2026-12-21').noonUTC});
  const summer = exposure.sunlightAt({point, date: daylight('2026-06-21').noonUTC});
  assert.equal(winter.reason, 'building-shadow'); assert.equal(summer.reason, 'sun');
  assert.equal(exposure.sunlightAt({point, date: moscowDate('2026-12-21', 0)}).reason, 'below-horizon');
  exposure.dispose(); destroy(f.root);
});

await check('Exact box triangle classification vs independent analytic faces for every daylight minute', () => {
  const f = fixtureBox(), exposure = createSolarExposure(f); let compared = 0;
  for (const day of ['2026-03-21', '2026-06-21', '2026-09-21', '2026-12-21']) {
    for (const point of [enu(0, 20, .5).toArray(), enu(12, 14, 1.7).toArray()]) {
      for (let minute = 180; minute <= 1320; minute++) {
        const date = moscowDate(day, minute), actual = exposure.sunlightAt({point, date}).sunlit;
        assert.equal(actual, analyticSunlit(point, date, f), `${day} ${minute}: triangle / analytic mismatch`); compared++;
      }
    }
  }
  exposure.dispose(); destroy(f.root); return {minuteComparisons: compared};
});

await check('Opening inside one mesh AABB stays sunlit: bounds are not a shadow proxy', () => {
  const root = new THREE.Group(), parts = [];
  for (const [x, y, width, height] of [[-8, 5, 4, 10], [8, 5, 4, 10], [0, 8.5, 12, 3]]) {
    const g = new THREE.BoxGeometry(width, height, 1).toNonIndexed(); g.translate(x, y, 0); parts.push(g);
  }
  const values = new Float32Array(parts.reduce((n, g) => n + g.attributes.position.array.length, 0));
  let offset = 0; for (const g of parts) {values.set(g.attributes.position.array, offset); offset += g.attributes.position.array.length; g.dispose();}
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); mesh.rotation.y = frameAngle; root.add(mesh);
  const exposure = createSolarExposure({root}), point = enu(0, 20, .5).toArray();
  assert.equal(exposure.sunlightAt({point, date: daylight('2026-12-21').noonUTC}).sunlit, true);
  const throughOpening = new THREE.Raycaster(enu(0, 20, 4), enu(0, -1, 0));
  assert.equal(exposure.pick(throughOpening), null, 'Ray through the real opening must not hit the whole AABB');
  exposure.dispose(); destroy(root);
});

await check('Picker returns actual roof / wall surface and transformed geometric normal', () => {
  const f = fixtureBox(), exposure = createSolarExposure(f);
  const roof = exposure.pick(new THREE.Raycaster(enu(0, 0, 25), new THREE.Vector3(0, -1, 0)));
  near(roof.point[1], 10, 1e-8, 'roof height'); near(roof.normal[1], 1, 1e-8, 'roof normal');
  const wall = exposure.pick(new THREE.Raycaster(enu(0, 20, 5), enu(0, -1, 0)));
  near(dotEN(wall.point).n, 5, 1e-6, 'wall north coordinate'); near(dotEN(wall.normal).n, 1, 1e-6, 'wall outward normal');
  const ground = exposure.pick(new THREE.Raycaster(enu(30, 20, 25), new THREE.Vector3(0, -1, 0)));
  assert.equal(ground.fallbackGround, true); near(ground.point[1], 0, 1e-8, 'fallback ground');
  // A facade point still receives a shadow when the sun is on the far side.
  assert.equal(exposure.sunlightAt({point: wall.point, date: daylight('2026-12-21').noonUTC}).sunlit, false);
  assert.equal(exposure.sunlightAt({point: roof.point, date: daylight('2026-12-21').noonUTC}).sunlit, true);
  exposure.dispose(); destroy(f.root);
});

await check('Transformed instances share exact geometry and preserve nonuniform dimensions', () => {
  const root = new THREE.Group(), instances = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 2; i++) {dummy.position.copy(enu(i * 50, 0, 5 + i * 2)); dummy.rotation.y = frameAngle; dummy.scale.set(20, 10 + i * 4, 10); dummy.updateMatrix(); instances.setMatrixAt(i, dummy.matrix);}
  root.add(instances); const exposure = createSolarExposure({root});
  const a = exposure.pick(new THREE.Raycaster(enu(0, 0, 30), new THREE.Vector3(0, -1, 0)));
  const b = exposure.pick(new THREE.Raycaster(enu(50, 0, 30), new THREE.Vector3(0, -1, 0)));
  near(a.point[1], 10, 1e-8, 'instance 0 roof'); near(b.point[1], 14, 1e-8, 'instance 1 roof');
  assert.equal(exposure.describeOccluders().bvhGeometries, 1);
  exposure.dispose(); destroy(root);
});

await check('Presentation visibility and transparent glass do not silently change structural rules', () => {
  const f = fixtureBox(); f.root.visible = false; const exposure = createSolarExposure(f), point = enu(0, 20, .5).toArray();
  assert.equal(exposure.sunlightAt({point, date: daylight('2026-12-21').noonUTC}).sunlit, false);
  const transparent = fixtureBox({transparent: true}), clear = createSolarExposure(transparent);
  assert.equal(clear.describeOccluders().meshCount, 0);
  assert.equal(clear.sunlightAt({point, date: daylight('2026-12-21').noonUTC}).sunlit, true);
  exposure.dispose(); clear.dispose(); destroy(f.root); destroy(transparent.root);
});

await check('Daily sunlight intervals vs an independent one-minute box calculation', async () => {
  const f = fixtureBox(), exposure = createSolarExposure(f), point = enu(12, 14, 1.7).toArray(), days = [];
  for (const day of ['2026-03-21', '2026-06-21', '2026-12-21']) {
    let expected = 0;
    for (let minute = .5; minute < 1440; minute++) if (analyticSunlit(point, moscowDate(day, minute), f)) expected++;
    const result = await exposure.day({point, day, stepMinutes: 5});
    near(result.sunlightMinutes, expected, 1.5, `${day} direct-sun minutes`);
    assert.ok(result.intervals.every(i => i.start >= 0 && i.end <= 1440 && i.end > i.start));
    days.push({day, modelMinutes: result.sunlightMinutes, independentMinutes: expected, intervals: result.intervals});
  }
  exposure.dispose(); destroy(f.root); return {days};
});

await check('Monthly sampling, real calendar days, progress, cancellation and non-destructive disposal', async () => {
  const root = new THREE.Group(), exposure = createSolarExposure({root}), point = [0, .1, 0];
  let progress = 0;
  const result = await exposure.year({point, year: 2026, dayOfMonth: 31, stepMinutes: 10, onProgress: event => {assert.ok(event.fraction >= progress); progress = event.fraction;}});
  assert.equal(result.months.length, 12); assert.equal(result.months[1].day, '2026-02-28');
  assert.equal(result.months[3].day, '2026-04-30'); assert.equal(progress, 1);
  assert.equal(result.sunlightHours, undefined, '12 selected days must not be passed off as an annual total');
  const controller = new AbortController();
  await assert.rejects(exposure.day({point, day: '2026-10-11', signal: controller.signal,
    onProgress: () => controller.abort()}), {name: 'AbortError'});
  const preparedFixture = fixtureBox(), prepared = createSolarExposure(preparedFixture), prepareController = new AbortController();
  await assert.rejects(prepared.prepare({signal: prepareController.signal,
    onProgress: () => prepareController.abort()}), {name: 'AbortError'});
  prepared.dispose(); destroy(preparedFixture.root);
  exposure.dispose(); exposure.dispose(); assert.equal(root.children.length, 0);
  assert.throws(() => exposure.describeOccluders(), /disposed/);
});

const source = fs.readFileSync(new URL('../../dist/solar-exposure.js', import.meta.url));
const result = {status: 'PASS', version: 31, checkedUTC: new Date().toISOString(), checks: checkResults,
  solarExposureSHA256: crypto.createHash('sha256').update(source).digest('hex'),
  scope: 'Independent synthetic geometry + interval tests. Real-scene integration/performance is separately recorded.'};
fs.writeFileSync(new URL('./solar-exposure-check-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, checks: checkResults.length, solarExposureSHA256: result.solarExposureSHA256}));
