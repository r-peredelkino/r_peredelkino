// Real-scene CPU integration check. Browser / GPU quality is a separate gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {createSolarExposure} from '../../dist/solar-exposure.js';

const now = () => performance.now(), start = now(), model = createComplex();
const modelMilliseconds = now() - start, exposure = createSolarExposure(model);
const initial = exposure.describeOccluders();
assert.equal(initial.includesVegetation, false);
assert.ok(initial.categories['Соседние общественные здания'] >= 5, 'The batched shopping, medical and utility walls/roofs are included');
assert.ok(initial.categories['Соседние жилые дома'] > 0);
assert.ok(initial.categories['Офис продаж'] > 0);
assert.ok(initial.categories['Арена'] > 0);
assert.ok(initial.sourceTriangles > 100000 && initial.sourceTriangles < 3000000, 'Keep actual architecture without the forest or flowering plants');

// Tick responsiveness during cooperative BVH preparation and day/year work.
const heartbeats = []; let last = now();
const interval = setInterval(() => {const current = now(); heartbeats.push(current - last); last = current;}, 10);
const preparedStart = now(); await exposure.prepare(); const prepareMilliseconds = now() - preparedStart;
const results = [];
for (const [label, point] of [['plaza', [14, .08, -102]], ['courtyard', [0, .08, 0]], ['wall-height', [0, 20, -70]]]) {
  const before = now(), value = await exposure.day({point, day: '2026-10-11', stepMinutes: 5});
  assert.ok(value.sunlightHours >= 0 && value.sunlightHours < 24);
  assert.ok(value.samples.length === 289);
  results.push({label, point, sunlightHours: value.sunlightHours, intervals: value.intervals, milliseconds: now() - before});
}
const year = await exposure.year({point: [14, .08, -102], year: 2026, dayOfMonth: 21, stepMinutes: 10});
assert.equal(year.months.length, 12);
const tower = model.towers.get(3), origin = new THREE.Vector3(tower.spec.x, 140, tower.spec.z);
const pick = exposure.pick(new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)));
assert.ok(pick && !pick.fallbackGround && pick.point[1] > 70, 'Pick real upper architectural surface');
clearInterval(interval);
assert.ok(heartbeats.length > 0, 'The asynchronous calculation yielded to the event loop');
const result = {
  status: 'PASS', version: 31, runUTC: new Date().toISOString(), metadata: exposure.describeOccluders(),
  solarExposureSHA256: crypto.createHash('sha256').update(fs.readFileSync(new URL('../../dist/solar-exposure.js', import.meta.url))).digest('hex'),
  modelMilliseconds, prepareMilliseconds, points: results, roofPick: pick,
  monthly: {milliseconds: year.elapsedMilliseconds, values: year.months.map(day => ({day: day.day, sunlightHours: day.sunlightHours, intervals: day.intervals}))},
  cooperativeScheduling: {timerIntervalMilliseconds: 10, ticks: heartbeats.length, maximumObservedTickMilliseconds: Math.max(...heartbeats),
    note: 'CPU fixture observation, not a GPU frame-rate or device-performance guarantee'},
  elapsedMilliseconds: now() - start,
};
fs.writeFileSync(new URL('./solar-exposure-scene-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, meshes: result.metadata.meshCount, instances: result.metadata.instanceCount,
  actualTriangles: result.metadata.sourceTriangles, prepareMilliseconds, monthlyMilliseconds: year.elapsedMilliseconds,
  maximumObservedTickMilliseconds: result.cooperativeScheduling.maximumObservedTickMilliseconds}));
exposure.dispose(); model.dispose();
