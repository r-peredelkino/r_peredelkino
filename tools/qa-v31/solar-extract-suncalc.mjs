// Read-only numerical extraction from the public SunCalc.org calculation script.
// Usage: TZ=UTC node solar-extract-suncalc.mjs /path/to/somotools.min.js
// The source script is NOT embedded in the app or redistributed by this project.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Supply a locally downloaded public SunCalc.org somotools.min.js file');
if (new Date('2026-06-21T12:00:00Z').getTimezoneOffset() !== 0) throw new Error('Run with TZ=UTC; SunCalc.org expects Date clock fields');
const raw = fs.readFileSync(sourcePath);
const box = {module: {exports: {}}};
vm.createContext(box);
vm.runInContext(raw.toString('utf8'), box, {timeout: 1000});
const source = box.module.exports;
const latitude = 55.6367, longitude = 37.3525;
const days = Array.from({length: 12}, (_, i) => `2026-${String(i + 1).padStart(2, '0')}-21`);
days.push('2026-10-11');
const records = [], dayRecords = [];
const utcISO = (day, minutes) => new Date(Date.parse(`${day}T00:00:00+03:00`) + minutes * 60000).toISOString();
const clock = value => value instanceof Date || typeof value?.getUTCHours === 'function'
  ? value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60 : null;
for (const day of days) {
  for (const minutes of [0, 360, 432, 540, 720, 900, 1080, 1439]) {
    const utc = utcISO(day, minutes);
    // offset=0 since this Date already contains the absolute UTC instant.
    const p = source.getSunCoor(new Date(utc), latitude, longitude, 0);
    records.push({utc, day, minutes, latitude, longitude, azimuth: p.Azimuth_Deg, apparentElevation: p.Altitude_Deg});
  }
  // DayInfo returns local civil clock fields as a Date, not an absolute UTC instant.
  const d = source.getSunDayInfo(new Date(`${day}T12:00:00Z`), latitude, longitude, 180, 'en');
  dayRecords.push({day, latitude, longitude, rise: clock(d.Rise), set: clock(d.Set), noon: clock(d.Transit), durationMinutes: d.DaylightDurationHours * 60});
}
const result = {
  provider: 'SunCalc.org / Torsten Hoffmann',
  sourceURL: 'https://www.suncalc.org/scripts/somotools.min.js?v=1.8',
  sourceSHA256: crypto.createHash('sha256').update(raw).digest('hex'), sourceBytes: raw.length,
  extractedUTC: new Date().toISOString(),
  referenceDefinition: 'getSunCoor(): refraction-corrected altitude; getSunDayInfo(): Moscow civil clock minutes.',
  note: 'Calculated numerical results only. The independent calculation script is not included in this project.',
  records, dayRecords,
};
const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'solar-reference-suncalc.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output, positions: records.length, days: dayRecords.length, sourceSHA256: result.sourceSHA256}));
