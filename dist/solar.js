import {geoFrame} from './geo-reference.js?v=community38';

// Concept / programmatic 3D reconstruction attribution: @r_peredelkino.
// v31: Meeus / NOAA Julian-century solar ephemeris, independent of host time zone.
// Equations: https://gml.noaa.gov/grad/solcalc/calcdetails.html
// Reference comparison: tools/qa-v31/solar-reference-jpl.json (NASA/JPL Horizons).
// These angles do not certify the reconstructed buildings or statutory insolation.
export const location = {
  latitude: geoFrame.worldOriginLonLat[1], longitude: geoFrame.worldOriginLonLat[0],
  timeZone: 'Europe/Moscow',
  // Legacy diagram axes: facade/landscape placement must keep these unchanged.
  north: [.71691, .69716], east: [-.69716, .71691],
  // Geographic axes: only these may orient the sun and compass in the 3D scene.
  actualNorth: geoFrame.northWorld, actualEast: geoFrame.eastWorld,
};
export const solarModel = Object.freeze({
  name: 'Meeus / NOAA Julian-century equations',
  azimuthConvention: 'degrees clockwise from true north',
  elevationConvention: 'solar centre above local horizontal plane',
  sunriseGeometricElevation: -.833,
  refraction: 'NOAA standard atmosphere; not measured weather or terrain',
  timeZone: location.timeZone,
});
const RAD = Math.PI / 180, DAY = 86400000, MINUTE = 60000;
const clamp = value => Math.max(-1, Math.min(1, value));
const wrap = (value, size = 360) => ((value % size) + size) % size;
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
};
const timestamp = date => finite(date instanceof Date ? date.getTime() : date, 'Date');
const moscowFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: location.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function civilParts(time) {
  const p = Object.fromEntries(moscowFormatter.formatToParts(time).map(v => [v.type, v.value]));
  return {year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second};
}
function civilUTC({year, month, day, hour = 0, minute = 0, second = 0}) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}
function parseDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError('Expected a valid YYYY-MM-DD calendar date');
  const p = {year: +match[1], month: +match[2], day: +match[3]};
  const date = new Date(civilUTC(p));
  if (p.year < 1 || date.getUTCFullYear() !== p.year || date.getUTCMonth() + 1 !== p.month || date.getUTCDate() !== p.day) {
    throw new RangeError('Invalid calendar date');
  }
  return p;
}
const dateText = p => `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

function ephemeris(time) {
  const julianDay = time / DAY + 2440587.5;
  const t = (julianDay - 2451545) / 36525;
  const meanLongitude = wrap(280.46646 + t * (36000.76983 + t * .0003032));
  const meanAnomaly = wrap(357.52911 + t * (35999.05029 - .0001537 * t));
  const eccentricity = .016708634 - t * (.000042037 + .0000001267 * t);
  const m = meanAnomaly * RAD, l = meanLongitude * RAD;
  const centre = Math.sin(m) * (1.914602 - t * (.004817 + .000014 * t))
    + Math.sin(2 * m) * (.019993 - .000101 * t) + Math.sin(3 * m) * .000289;
  const omega = (125.04 - 1934.136 * t) * RAD;
  const apparentLongitude = meanLongitude + centre - .00569 - .00478 * Math.sin(omega);
  const obliquity = (23 + (26 + (21.448 - t * (46.815 + t * (.00059 - .001813 * t))) / 60) / 60
    + .00256 * Math.cos(omega)) * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude * RAD));
  const y = Math.tan(obliquity / 2) ** 2;
  const equation = 4 / RAD * (y * Math.sin(2 * l) - 2 * eccentricity * Math.sin(m)
    + 4 * eccentricity * y * Math.sin(m) * Math.cos(2 * l)
    - .5 * y * y * Math.sin(4 * l) - 1.25 * eccentricity ** 2 * Math.sin(2 * m));
  const distanceAU = 1.000001018 * (1 - eccentricity ** 2)
    / (1 + eccentricity * Math.cos((meanAnomaly + centre) * RAD));
  return {julianDay, declination, equation, distanceAU};
}

/** Approximate standard-atmosphere correction in degrees; never a terrain correction. */
export function atmosphericRefraction(elevation) {
  finite(elevation, 'Elevation');
  if (elevation > 85 || elevation < -5) return 0;
  const tangent = Math.tan(elevation * RAD);
  if (elevation > 5) return (58.1 / tangent - .07 / tangent ** 3 + .000086 / tangent ** 5) / 3600;
  if (elevation > -.575) return (1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * .711)))) / 3600;
  return -20.774 / tangent / 3600;
}

/**
 * Geocentric solar-centre position for an absolute Date / Unix millisecond time.
 * East longitude is positive. All returned angles are degrees, not radians.
 * elevation stays geometric for old callers. Use apparentElevation explicitly for
 * visible sunlight rays; geometricElevation for an airless numerical comparison.
 */
export function solarPosition(date, latitude = location.latitude, longitude = location.longitude) {
  const time = timestamp(date);
  finite(latitude, 'Latitude'); finite(longitude, 'Longitude');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new RangeError('Coordinates outside latitude/longitude range');
  const {julianDay, declination, equation, distanceAU} = ephemeris(time);
  const utcMinutes = wrap(time, DAY) / MINUTE;
  const hourAngle = wrap(utcMinutes + equation + 4 * longitude, 1440) / 4 - 180;
  const latitudeRad = latitude * RAD, h = hourAngle * RAD;
  const geometricElevation = Math.asin(clamp(Math.sin(latitudeRad) * Math.sin(declination)
    + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(h))) / RAD;
  // atan2 avoids the quadrant ambiguity and division by sin(zenith) in older calculators.
  const azimuth = wrap(Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(latitudeRad)
    - Math.tan(declination) * Math.cos(latitudeRad)) / RAD + 180);
  const refraction = atmosphericRefraction(geometricElevation);
  return {
    azimuth, elevation: geometricElevation, geometricElevation,
    apparentElevation: geometricElevation + refraction, refraction,
    equation, declination: declination / RAD, hourAngle, distanceAU, julianDay,
  };
}

/** Unit vector TOWARD the sun, in the geographic X/Y/Z frame of the model. */
export function direction(azimuth, elevation = 0, distance = 1) {
  finite(azimuth, 'Azimuth'); finite(elevation, 'Elevation'); finite(distance, 'Distance');
  const a = azimuth * RAD, h = elevation * RAD, c = Math.cos(h);
  return [
    (location.actualNorth[0] * Math.cos(a) + location.actualEast[0] * Math.sin(a)) * c * distance,
    Math.sin(h) * distance,
    (location.actualNorth[1] * Math.cos(a) + location.actualEast[1] * Math.sin(a)) * c * distance,
  ];
}

/** Flat-ground shadow of a vertical object, in the same length unit as height. */
export function shadowLength(height, elevation) {
  finite(height, 'Height'); finite(elevation, 'Elevation');
  if (height < 0 || elevation > 90 || elevation < -90) throw new RangeError('Invalid height or elevation');
  if (elevation <= 0) return null;
  return height / Math.tan(elevation * RAD);
}
export function shadowOffset(azimuth, elevation, height) {
  const length = shadowLength(height, elevation);
  return length === null ? null : direction(azimuth + 180, 0, length);
}

// Legacy diagram conversion, intentionally unrelated to geographic north.
export function mapPoint(east, north, y = 0) {
  return [east * location.east[0] + north * location.north[0], y,
    east * location.east[1] + north * location.north[1]];
}

export function moscowParts(date = new Date()) {
  const time = timestamp(date), p = civilParts(time);
  return {
    date: dateText(p), minutes: p.hour * 60 + p.minute,
    time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
    year: p.year, month: p.month, monthIndex: p.month - 1, day: p.day, seconds: p.second,
    utcOffsetMinutes: (civilUTC(p) - Math.floor(time / 1000) * 1000) / MINUTE,
  };
}

/** Moscow CIVIL day + clock minutes -> absolute Unix milliseconds, independent of host zone. */
export function moscowDate(day, minutes = 0) {
  const target = civilUTC(parseDay(day)) + finite(minutes, 'Minutes') * MINUTE;
  let time = target - 180 * MINUTE;
  for (let i = 0; i < 5; i++) {
    const difference = target - civilUTC(civilParts(time)) - wrap(time, 1000);
    if (Math.abs(difference) < .5) return time;
    time += difference;
  }
  throw new RangeError('This Moscow civil time does not exist because of a clock transition');
}

/** Fixed comparison days in the SELECTED year, not claims about exact equinox instants. */
export function seasonalDays(day = moscowParts().date) {
  const year = String(parseDay(day).year).padStart(4, '0');
  return {spring: `${year}-03-21`, summer: `${year}-06-21`, autumn: `${year}-09-21`, winter: `${year}-12-21`};
}
export function upcomingWinter(date = new Date()) {
  const p = moscowParts(date), year = p.date > `${p.year}-12-21` ? p.year + 1 : p.year;
  return `${String(year).padStart(4, '0')}-12-21`;
}

/** Sunrise/set of the upper solar limb over an unobstructed standard horizon. */
export function daylight(day, latitude = location.latitude, longitude = location.longitude) {
  const start = moscowDate(day, 0), end = moscowDate(day, 1440);
  const elevation = time => solarPosition(time, latitude, longitude).geometricElevation;
  const threshold = solarModel.sunriseGeometricElevation;
  const crossings = [];
  let previousTime = start, previous = elevation(start) - threshold;
  let aboveDuration = 0, aboveStart = previous >= 0 ? start : null;
  for (let time = Math.min(start + 10 * MINUTE, end); time <= end; time = Math.min(time + 10 * MINUTE, end)) {
    const current = elevation(time) - threshold;
    if ((previous >= 0) !== (current >= 0)) {
      let a = previousTime, b = time, side = previous >= 0;
      while (b - a > 250) {
        const middle = (a + b) / 2;
        if ((elevation(middle) >= threshold) === side) a = middle; else b = middle;
      }
      const crossing = (a + b) / 2, rising = current >= 0;
      crossings.push({time: crossing, rising});
      if (rising) aboveStart = crossing;
      else if (aboveStart !== null) {aboveDuration += crossing - aboveStart; aboveStart = null;}
    }
    previousTime = time; previous = current;
    if (time === end) break;
  }
  if (aboveStart !== null) aboveDuration += end - aboveStart;
  const clockMinute = time => {
    if (time == null) return null;
    const p = moscowParts(time);
    return p.minutes + p.seconds / 60 + wrap(time, 1000) / MINUTE;
  };
  // Meridian transit (hour angle zero); a day on this site has exactly one transit.
  let noon = start + 12 * 60 * MINUTE;
  for (let i = 0; i < 5; i++) noon -= solarPosition(noon, latitude, longitude).hourAngle * 4 * MINUTE;
  while (noon < start) noon += DAY;
  while (noon >= end) noon -= DAY;
  const riseUTC = crossings.find(c => c.rising)?.time ?? null;
  const setUTC = crossings.find(c => !c.rising)?.time ?? null;
  return {
    rise: clockMinute(riseUTC), set: clockMinute(setUTC), noon: clockMinute(noon),
    riseUTC, setUTC, noonUTC: noon, durationMinutes: aboveDuration / MINUTE,
    alwaysUp: crossings.length === 0 && previous >= 0,
    alwaysDown: crossings.length === 0 && previous < 0,
    threshold, horizon: 'unobstructed standard horizon; buildings and terrain not included',
  };
}

export const timeLabel = minutes => minutes == null || !Number.isFinite(minutes) ? '—'
  : `${String(Math.floor(wrap(Math.round(minutes), 1440) / 60)).padStart(2, '0')}:${String(wrap(Math.round(minutes), 60)).padStart(2, '0')}`;
