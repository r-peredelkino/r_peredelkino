// Offline numerical acceptance. Sources are independently calculated saved values,
// not another copy of the implementation under test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  solarPosition, direction, shadowLength, shadowOffset, location, solarModel,
  moscowDate, moscowParts, daylight, seasonalDays, upcomingWinter, timeLabel,
} from '../../dist/solar.js';
import {geoFrame} from '../../dist/geo-reference.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
const jpl = readJSON('solar-reference-jpl.json'), source = readJSON('solar-reference-suncalc.json');
const angularError = (a, b) => Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
const checks = [];
const check = (name, work) => {const details = work(); checks.push({name, status: 'PASS', ...(details ?? {})});};
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} vs ${expected}; allowed ${tolerance}`);
const worst = () => ({value: 0, utc: null});
const track = (record, value, utc) => {if (value > record.value) {record.value = value; record.utc = utc;}};

check('Independent JPL source bytes and reference provenance', () => {
  assert.equal(jpl.provider, 'NASA/JPL Horizons');
  assert.equal(jpl.records.length, 198);
  for (const source of jpl.sources) {
    const raw = fs.readFileSync(path.join(here, source.file));
    assert.equal(sha(raw), source.sha256); assert.equal(raw.length, source.bytes);
    assert.equal(source.parameters.APPARENT, "'AIRLESS'");
    assert.equal(source.parameters.COMMAND, "'10'");
  }
  return {samples: jpl.records.length, sourceBodies: jpl.sources.length};
});

check('Airless angles against NASA/JPL across 12 months, day/night, leap year and future year', () => {
  const azimuth = worst(), elevation = worst(), daytimeElevation = worst();
  for (const row of jpl.records) {
    const p = solarPosition(new Date(row.utc), row.latitude, row.longitude);
    const da = angularError(p.azimuth, row.azimuth), de = Math.abs(p.geometricElevation - row.airlessElevation);
    assert.ok(da < .02, `JPL azimuth ${row.utc}: ${da} degrees`);
    assert.ok(de < .012, `JPL elevation ${row.utc}: ${de} degrees`);
    track(azimuth, da, row.utc); track(elevation, de, row.utc);
    if (row.airlessElevation > 0) track(daytimeElevation, de, row.utc);
    assert.equal(p.elevation, p.geometricElevation, 'old elevation API remains geometric');
  }
  return {maxAzimuthErrorDegrees: azimuth, maxElevationErrorDegrees: elevation, maxDaytimeElevationErrorDegrees: daytimeElevation};
});

check('Visible sun against the actual SunCalc.org calculation module', () => {
  assert.equal(source.sourceSHA256, 'bffd08725838388ce53399532868e14f3b551b46e7e3744cc1d73ad8a9944e1e');
  const azimuth = worst(), elevation = worst(); let visible = 0;
  for (const row of source.records) {
    const p = solarPosition(new Date(row.utc), row.latitude, row.longitude);
    // Different refraction formulae are undefined as an observation far below the
    // horizon. No below-horizon ray may illuminate the scene; test the useful domain.
    if (row.apparentElevation <= 0) continue;
    visible++;
    const da = angularError(p.azimuth, row.azimuth), de = Math.abs(p.apparentElevation - row.apparentElevation);
    assert.ok(da < .02, `SunCalc.org azimuth ${row.utc}: ${da}`);
    assert.ok(de < .012, `SunCalc.org visible elevation ${row.utc}: ${de}`);
    track(azimuth, da, row.utc); track(elevation, de, row.utc);
  }
  return {visibleSamples: visible, maxAzimuthErrorDegrees: azimuth, maxApparentElevationErrorDegrees: elevation};
});

check('SunCalc.org sunrise / sunset / transit in Moscow for all months', () => {
  const eventError = worst(), transitError = worst();
  for (const row of source.dayRecords) {
    const p = daylight(row.day, row.latitude, row.longitude);
    for (const event of ['rise', 'set']) {
      near(p[event], row[event], 1, `${row.day} ${event} clock minutes`);
      track(eventError, Math.abs(p[event] - row[event]) * 60, `${row.day} ${event}`);
    }
    near(p.noon, row.noon, .1, `${row.day} solar transit minutes`);
    track(transitError, Math.abs(p.noon - row.noon) * 60, row.day);
  }
  return {days: source.dayRecords.length, maxRiseSetErrorSeconds: eventError, maxTransitErrorSeconds: transitError,
    note: 'Standard-horizon definitions differ; this is a reference comparison, not observed sunrise accuracy.'};
});

check('User reference date / time and shadow length', () => {
  const instant = moscowDate('2026-10-11', 7 * 60 + 12);
  assert.equal(new Date(instant).toISOString(), '2026-10-11T04:12:00.000Z');
  const p = solarPosition(instant, 55.6367, 37.3525);
  near(p.azimuth, 105.20934938577604, .01, '07:12 azimuth');
  near(p.apparentElevation, 2.094309644939313, .012, '07:12 SunCalc apparent altitude');
  assert.ok(p.apparentElevation > p.geometricElevation);
  const d = daylight('2026-10-11');
  const perMetre = shadowLength(1, p.apparentElevation);
  return {moscow: '2026-10-11 07:12', utc: new Date(instant).toISOString(), solar: p,
    shadowMetresPerMetreHeightOnFlatGround: perMetre,
    sunriseMoscow: timeLabel(d.rise), noonMoscow: timeLabel(d.noon), sunsetMoscow: timeLabel(d.set)};
});

check('True north / east axes, cardinal quadrants and normalized light direction', () => {
  const n = direction(0), e = direction(90), s = direction(180), w = direction(270);
  near(n[0], geoFrame.northWorld[0], 1e-12, 'true north x');
  near(n[2], geoFrame.northWorld[1], 1e-12, 'true north z');
  near(e[0], geoFrame.eastWorld[0], 1e-12, 'true east x');
  near(e[2], geoFrame.eastWorld[1], 1e-12, 'true east z');
  for (let axis = 0; axis < 3; axis++) {near(n[axis], -s[axis], 1e-12, 'north / south'); near(e[axis], -w[axis], 1e-12, 'east / west');}
  assert.ok(Math.abs(n[0] - location.north[0]) > .5, 'legacy diagram north must not orient the sunlight');
  for (let azimuth = 0; azimuth < 360; azimuth += 15) {
    for (const elevation of [-20, 0, 5, 30, 60, 89]) {
      const d = direction(azimuth, elevation);
      near(Math.hypot(...d), 1, 1e-12, 'unit direction');
      near(d[1], Math.sin(elevation * Math.PI / 180), 1e-12, 'physical elevation is not scaled or clamped');
    }
  }
});

check('Shadow projection is opposite the sun and uses h / tan(elevation)', () => {
  near(shadowLength(10, 45), 10, 1e-12, '45 degree shadow');
  near(shadowLength(10, 30), 10 * Math.sqrt(3), 1e-12, '30 degree shadow');
  near(shadowLength(10, 90), 0, 1e-12, 'zenith shadow');
  assert.equal(shadowLength(10, 0), null); assert.equal(shadowLength(10, -5), null);
  const ray = direction(90, 30), offset = shadowOffset(90, 30, 10);
  assert.equal(offset[1], 0);
  near(offset[0] + ray[0] * 10 / ray[1], 0, 1e-10, 'shadow tip x intersects horizontal plane');
  near(offset[2] + ray[2] * 10 / ray[1], 0, 1e-10, 'shadow tip z intersects horizontal plane');
});

check('Moscow calendar boundaries, historical offset and invalid input', () => {
  const p = moscowParts(new Date('2026-11-30T23:45:00Z'));
  assert.equal(p.date, '2026-12-01'); assert.equal(p.monthIndex, 11); assert.equal(p.time, '02:45');
  assert.equal(p.utcOffsetMinutes, 180);
  assert.equal(new Date(moscowDate('2024-02-29', 1439)).toISOString(), '2024-02-29T20:59:00.000Z');
  assert.equal(new Date(moscowDate('2026-12-31', 1440)).toISOString(), '2026-12-31T21:00:00.000Z');
  assert.equal(moscowParts(moscowDate('2012-06-21', 720)).utcOffsetMinutes, 240, 'IANA Moscow history, no hard-coded +3');
  assert.equal(moscowParts(moscowDate('2012-06-21', 720)).time, '12:00');
  assert.deepEqual(seasonalDays('2030-01-11'), {spring: '2030-03-21', summer: '2030-06-21', autumn: '2030-09-21', winter: '2030-12-21'});
  assert.equal(upcomingWinter(new Date('2026-12-24T12:00:00Z')), '2027-12-21');
  for (const day of ['2026-02-29', '2026-13-10', '2026-04-31', '', 'not-a-date']) assert.throws(() => moscowDate(day, 720), RangeError);
  assert.throws(() => solarPosition(new Date('invalid')), RangeError);
  assert.throws(() => solarPosition(new Date(), 100, 37), RangeError);
  assert.throws(() => moscowDate('2026-10-11', NaN), RangeError);
  assert.equal(timeLabel(null), '—'); assert.equal(timeLabel(1439.8), '00:00');
});

check('Same Moscow selections under UTC, Moscow, Los Angeles and Tokyo host time zones', () => {
  const solarURL = new URL('../../dist/solar.js', import.meta.url).href;
  const script = `import {moscowDate,moscowParts,solarPosition,daylight} from ${JSON.stringify(solarURL)}; const t=moscowDate('2026-10-11',432); console.log(JSON.stringify({t,p:moscowParts(t),sun:solarPosition(t),day:daylight('2026-10-11')}));`;
  let expected;
  for (const TZ of ['UTC', 'Europe/Moscow', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const processResult = spawnSync(process.execPath, ['--input-type=module', '-e', script], {encoding: 'utf8', env: {...process.env, TZ}});
    assert.equal(processResult.status, 0, processResult.stderr);
    expected ??= processResult.stdout;
    assert.equal(processResult.stdout, expected, `host-zone leak for ${TZ}`);
  }
});

check('Horizon roots, solar noon, quarterly daylight and polar edge cases', () => {
  const comparisons = [];
  for (const day of Object.values(seasonalDays('2026-10-11'))) {
    const d = daylight(day);
    assert.ok(d.rise < d.noon && d.noon < d.set);
    for (const instant of [d.riseUTC, d.setUTC]) near(solarPosition(instant).geometricElevation, solarModel.sunriseGeometricElevation, .0005, 'sunrise / sunset crossing');
    near(solarPosition(d.noonUTC).hourAngle, 0, 1e-6, 'meridian transit');
    comparisons.push({day, rise: timeLabel(d.rise), noon: timeLabel(d.noon), set: timeLabel(d.set), durationMinutes: d.durationMinutes});
  }
  assert.ok(comparisons[1].durationMinutes > 1000); assert.ok(comparisons[3].durationMinutes < 450);
  const polarSummer = daylight('2026-06-21', 80, 37), polarWinter = daylight('2026-12-21', 80, 37);
  assert.equal(polarSummer.alwaysUp, true); assert.equal(polarSummer.durationMinutes, 1440);
  assert.equal(polarWinter.alwaysDown, true); assert.equal(polarWinter.durationMinutes, 0);
  assert.equal(polarSummer.rise, null); assert.equal(polarWinter.set, null);
  return {comparisons};
});

const result = {status: 'PASS', version: 31, runUTC: new Date().toISOString(),
  solarSHA256: sha(fs.readFileSync(new URL('../../dist/solar.js', import.meta.url))),
  sourceFiles: {
    jpl: sha(fs.readFileSync(path.join(here, 'solar-reference-jpl.json'))),
    suncalc: sha(fs.readFileSync(path.join(here, 'solar-reference-suncalc.json'))),
  },
  checkCount: checks.length, checks,
  limitations: [
    'Observed refraction depends on the atmosphere; no terrain-horizon correction is implied.',
    'The JPL comparison includes topocentric parallax; the compact NOAA equations are geocentric.',
    'Tested angular errors are measured on this fixture, not a universal uncertainty guarantee.',
    'Building location, height, geometry, ground level and shadow-map coverage need separate verification.',
  ],
};
fs.writeFileSync(path.join(here, 'solar-check-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, checks: result.checkCount, jplSamples: jpl.records.length, suncalcSamples: source.records.length, suncalcDays: source.dayRecords.length, solarSHA256: result.solarSHA256}));
