import * as THREE from './vendor/three.module.js';
import {solarPosition, direction, moscowDate, daylight, location} from './solar.js?v=references37';
import {geoFrame} from './geo-reference.js?v=references37';

// Direct sunlight against the real, opaque structural triangles of this model.
// No tree/terrain/weather model and no statutory apartment-insolation claim.
const EPSILON = .002, SLICE_MS = 8, LEAF_SIZE = 12;
const now = () => globalThis.performance?.now() ?? Date.now();
const yieldFrame = () => new Promise(resolve => setTimeout(resolve, 0));
const abort = signal => {
  if (!signal?.aborted) return;
  const error = new Error('Solar exposure calculation cancelled'); error.name = 'AbortError'; throw error;
};
const pointArray = value => {
  const result = value?.isVector3 ? value.toArray() : value;
  if (!Array.isArray(result) || result.length !== 3 || !result.every(Number.isFinite)) throw new TypeError('point must contain three finite world coordinates');
  return result.slice();
};
const isOpaque = mesh => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.length > 0 && materials.every(m => m && !m.transparent && m.opacity >= .999 && !m.alphaTest && !m.alphaMap);
};

function structuralMeshes(model) {
  const records = new Map();
  const add = (object, category, predicate = () => true) => {
    object?.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position || !isOpaque(mesh) || !predicate(mesh)) return;
      if (mesh.isSkinnedMesh || mesh.morphTargetInfluences?.some(Boolean)) return;
      records.set(mesh, {mesh, category, name: mesh.name || category});
    });
  };
  if (model?.towers instanceof Map) {
    for (const [id, tower] of model.towers) {
      add(tower.group, id === 0 ? 'Офисный корпус' : `Корпус ${id}`, mesh =>
        mesh !== tower.windows && mesh !== tower.panels && mesh !== tower.belt
        && !/window frames|office fins|Resident windows/i.test(mesh.name));
    }
    for (const object of [model.pedestal, model.upperPedestal, model.baseCap, model.bridge, model.bridgeDetails]) add(object, 'Подиум и общая кровля');
    // Some of the unchanged deck objects are direct root children, not in the API.
    for (const object of model.root.children) {
      if (/^(Podium roof slab|Upper white commercial cornice)/.test(object.name)) add(object, 'Подиум и общая кровля');
      if (object.userData.referencePart) add(object, 'Соседние общественные здания', mesh => !/glaz|window|arborvitae|tree|needle|railing/i.test(mesh.name));
    }
    add(model.arenaExterior?.group, 'Арена');
    add(model.exteriorRoofs?.group, 'Кровли и оборудование');
    add(model.commercialFrontage?.group, 'Коммерческие галереи', mesh =>
      mesh !== model.commercialFrontage.shopWindows && mesh !== model.commercialFrontage.doorHandles
      && !/interior|handle/i.test(mesh.name));
    add(model.salesOffice?.office, 'Офис продаж');
    add(model.neighborhood?.neighborBuildings?.group, 'Соседние жилые дома', mesh =>
      mesh.castShadow && !['glass', 'litGlass', 'recess'].includes(mesh.material?.userData?.neighborRole));
    add(model.neighborhood?.contextServices?.group, 'Соседние служебные здания', mesh => !/window/i.test(mesh.name));
    // The reference backdrop is attached directly to the neighbourhood group.
    model.neighborhood?.group?.traverse(mesh => {
      if (mesh.userData.referencePart) add(mesh, 'Соседние общественные здания', item => !/glaz|window|arborvitae|tree|needle|railing/i.test(item.name));
      // The established neighbourhood batcher preserves material identity but
      // discards individual referencePart tags. These five dedicated mineral
      // materials contain the actual shopping, medical and utility envelopes.
      if (/^Reference shopping frontage \/|^Reference context \/ (light window frames and utility walls|dark base|dark mineral roofs)$/.test(mesh.material?.map?.name || mesh.material?.name || '')) {
        add(mesh, 'Соседние общественные здания');
      }
    });
    add(model.publicRealm?.forecourt?.architecture?.group, 'Павильон, навесы и галерея', mesh =>
      (mesh.userData.types ?? [mesh.userData.type]).some(type => /pavilion|canopy|commercial-gallery/.test(type ?? '')));
  } else {
    // Generic fixture / consumer: explicitly supply the opaque structural group.
    add(model?.root ?? model, 'Конструктивная геометрия', mesh => mesh.userData.solarOccluder !== false);
  }
  return [...records.values()];
}

function aabbHit(origin, ray, bounds, maximum = Infinity) {
  let near = 0, far = maximum;
  for (let axis = 0; axis < 3; axis++) {
    const start = origin[axis], delta = ray[axis], lo = bounds[axis], hi = bounds[axis + 3];
    if (Math.abs(delta) < 1e-15) {if (start < lo || start > hi) return null; continue;}
    let a = (lo - start) / delta, b = (hi - start) / delta;
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a); far = Math.min(far, b);
    if (far < near) return null;
  }
  return near;
}

// Geometry BVH keeps the exact source triangles. Instances share one local tree;
// their independent inverse matrices and world bounds preserve placement/scale.
function* buildBVHSteps(geometry) {
  const position = geometry.attributes.position, index = geometry.index;
  const firstVertex = geometry.drawRange?.start ?? 0;
  const count = Math.max(0, Math.floor(Math.min(geometry.drawRange?.count ?? Infinity, (index?.count ?? position.count) - firstVertex) / 3));
  const vertices = new Float64Array(count * 9), bounds = new Float64Array(count * 6);
  const centres = new Float64Array(count * 3), order = new Uint32Array(count);
  for (let triangle = 0; triangle < count; triangle++) {
    const base = triangle * 9, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < 3; vertex++) {
      const at = index ? index.getX(firstVertex + triangle * 3 + vertex) : firstVertex + triangle * 3 + vertex;
      const values = [position.getX(at), position.getY(at), position.getZ(at)];
      for (let axis = 0; axis < 3; axis++) {
        vertices[base + vertex * 3 + axis] = values[axis];
        lo[axis] = Math.min(lo[axis], values[axis]); hi[axis] = Math.max(hi[axis], values[axis]);
      }
    }
    bounds.set([...lo, ...hi], triangle * 6);
    for (let axis = 0; axis < 3; axis++) centres[triangle * 3 + axis] = (lo[axis] + hi[axis]) / 2;
    order[triangle] = triangle;
    if ((triangle & 1023) === 1023) yield;
  }
  const nodes = [];
  function* node(start, end) {
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) {
      const triangle = order[i];
      for (let axis = 0; axis < 3; axis++) {
        box[axis] = Math.min(box[axis], bounds[triangle * 6 + axis]);
        box[axis + 3] = Math.max(box[axis + 3], bounds[triangle * 6 + axis + 3]);
        low[axis] = Math.min(low[axis], centres[triangle * 3 + axis]);
        high[axis] = Math.max(high[axis], centres[triangle * 3 + axis]);
      }
      if ((i & 2047) === 2047) yield;
    }
    const record = {bounds: box, start, end, left: -1, right: -1}, id = nodes.length; nodes.push(record);
    if (end - start <= LEAF_SIZE) return id;
    let axis = 0;
    for (let a = 1; a < 3; a++) if (high[a] - low[a] > high[axis] - low[axis]) axis = a;
    if (high[axis] - low[axis] < 1e-10) return id;
    const middle = (start + end) >>> 1;
    // In-place quickselect: partition triangle IDs without touching source buffers.
    let first = start, last = end - 1;
    while (first < last) {
      const pivot = centres[order[(first + last) >>> 1] * 3 + axis];
      let a = first, b = last;
      while (a <= b) {
        while (centres[order[a] * 3 + axis] < pivot) a++;
        while (centres[order[b] * 3 + axis] > pivot) b--;
        if (a <= b) {const swap = order[a]; order[a] = order[b]; order[b] = swap; a++; b--;}
      }
      if (middle <= b) last = b; else if (middle >= a) first = a; else break;
    }
    record.left = yield* node(start, middle); record.right = yield* node(middle, end);
    return id;
  }
  if (count) yield* node(0, count);
  return {vertices, order, nodes, triangleCount: count};
}

function intersectBVH(tree, origin, direction, firstOnly) {
  if (!tree.nodes.length) return null;
  const stack = [0], p = tree.vertices; let nearest = Infinity, hit = null;
  while (stack.length) {
    const node = tree.nodes[stack.pop()];
    if (aabbHit(origin, direction, node.bounds, nearest) === null) continue;
    if (node.left >= 0) {stack.push(node.left, node.right); continue;}
    for (let at = node.start; at < node.end; at++) {
      const triangle = tree.order[at], i = triangle * 9;
      const e1x = p[i + 3] - p[i], e1y = p[i + 4] - p[i + 1], e1z = p[i + 5] - p[i + 2];
      const e2x = p[i + 6] - p[i], e2y = p[i + 7] - p[i + 1], e2z = p[i + 8] - p[i + 2];
      const px = direction[1] * e2z - direction[2] * e2y;
      const py = direction[2] * e2x - direction[0] * e2z;
      const pz = direction[0] * e2y - direction[1] * e2x;
      const determinant = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(determinant) < 1e-12) continue;
      const tx = origin[0] - p[i], ty = origin[1] - p[i + 1], tz = origin[2] - p[i + 2];
      const u = (tx * px + ty * py + tz * pz) / determinant;
      if (u < -1e-9 || u > 1 + 1e-9) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) / determinant;
      if (v < -1e-9 || u + v > 1 + 1e-9) continue;
      const distance = (e2x * qx + e2y * qy + e2z * qz) / determinant;
      if (distance < 1e-7 || distance >= nearest) continue;
      nearest = distance;
      hit = {distance, normal: [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x]};
      if (firstOnly) return hit;
    }
  }
  return hit;
}

export function createSolarExposure(model) {
  const constructionStart = now(), root = model?.root ?? model;
  if (!root?.updateMatrixWorld) throw new TypeError('A model root or Three.js Object3D is required');
  root.updateMatrixWorld(true);
  const sources = structuralMeshes(model), geometryCache = new Map(), instances = [];
  const local = new THREE.Matrix4(), world = new THREE.Matrix4(), box = new THREE.Box3();
  let disposed = false, bvhMilliseconds = 0;
  for (const source of sources) {
    const mesh = source.mesh, geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const count = mesh.isInstancedMesh ? mesh.count : 1;
    for (let i = 0; i < count; i++) {
      if (mesh.isInstancedMesh) {mesh.getMatrixAt(i, local); world.multiplyMatrices(mesh.matrixWorld, local);} else world.copy(mesh.matrixWorld);
      if (Math.abs(world.determinant()) < 1e-12) continue;
      box.copy(geometry.boundingBox).applyMatrix4(world);
      if (box.isEmpty()) continue;
      instances.push({source, geometry, instanceId: mesh.isInstancedMesh ? i : null,
        matrix: world.clone(), inverse: world.clone().invert(), normalMatrix: new THREE.Matrix3().getNormalMatrix(world),
        bounds: [...box.min.toArray(), ...box.max.toArray()]});
    }
  }
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const instance of instances) for (let i = 0; i < 3; i++) {
    bounds[i] = Math.min(bounds[i], instance.bounds[i]); bounds[i + 3] = Math.max(bounds[i + 3], instance.bounds[i + 3]);
  }
  const categories = {};
  for (const source of sources) categories[source.category] = (categories[source.category] ?? 0) + 1;
  const metadata = {
    method: 'Ray / actual opaque structural triangles; per-geometry BVH and per-instance broad-phase bounds',
    meshCount: sources.length, instanceCount: instances.length,
    sourceTriangles: sources.reduce((sum, item) => sum + (item.mesh.geometry.index?.count ?? item.mesh.geometry.attributes.position.count) / 3 * (item.mesh.isInstancedMesh ? item.mesh.count : 1), 0),
    categories, bounds: instances.length ? bounds : null,
    coordinates: 'world [x, y, z]', units: 'existing model units',
    horizontalMetersPerModelUnit: geoFrame.scale.metersPerFixedWorldUnit,
    verticalScale: 'uses actual world matrices; no assumed surveyed building heights',
    observerOffsetModelUnits: EPSILON, includesVegetation: false, includesTerrain: false,
    atmosphere: 'clear-sky direct solar centre, standard refraction; no weather attenuation',
    visibility: 'structural occlusion remains active when presentation layers are hidden',
    excluded: ['vegetation', 'people', 'vehicles', 'weather', 'glass transmission', 'window dressing', 'separate residential window-frame overlays', 'objects outside the reconstructed scene'],
    caution: 'Current reconstructed geometry, not a statutory apartment-insolation assessment',
    constructionMilliseconds: now() - constructionStart,
  };
  const ensureAlive = () => {if (disposed) throw new Error('Solar exposure disposed');};
  function treeFor(geometry) {
    let tree = geometryCache.get(geometry);
    if (!tree) {
      const start = now(), steps = buildBVHSteps(geometry); let result = steps.next();
      while (!result.done) result = steps.next();
      tree = result.value; bvhMilliseconds += now() - start; geometryCache.set(geometry, tree);
    }
    return tree;
  }
  async function prepare({signal, onProgress} = {}) {
    ensureAlive(); abort(signal);
    const geometries = [...new Set(instances.map(item => item.geometry))];
    let deadline = now() + SLICE_MS;
    for (let i = 0; i < geometries.length; i++) {
      const geometry = geometries[i];
      if (!geometryCache.has(geometry)) {
        const steps = buildBVHSteps(geometry); let result = steps.next(), activeStart = now();
        while (!result.done) {
          ensureAlive(); abort(signal);
          if (now() > deadline) {
            bvhMilliseconds += now() - activeStart; await yieldFrame(); ensureAlive(); abort(signal);
            activeStart = now(); deadline = activeStart + SLICE_MS;
          }
          result = steps.next();
        }
        bvhMilliseconds += now() - activeStart; geometryCache.set(geometry, result.value);
      }
      onProgress?.({phase: 'prepare', fraction: (i + 1) / geometries.length, completed: i + 1, total: geometries.length});
    }
    ensureAlive(); abort(signal);
    return describeOccluders();
  }
  const o = new THREE.Vector3(), d = new THREE.Vector3(), hitPoint = new THREE.Vector3(), normal = new THREE.Vector3();
  function intersect(origin, ray, firstOnly = false, maximum = Infinity) {
    const candidates = [];
    for (const instance of instances) {
      const distance = aabbHit(origin, ray, instance.bounds, maximum);
      if (distance !== null) candidates.push({instance, distance});
    }
    candidates.sort((a, b) => a.distance - b.distance);
    let nearest = maximum, result = null;
    for (const {instance, distance} of candidates) {
      if (distance > nearest) break;
      o.fromArray(origin).applyMatrix4(instance.inverse);
      d.fromArray(ray).transformDirection(instance.inverse);
      const hit = intersectBVH(treeFor(instance.geometry), o.toArray(), d.toArray(), firstOnly);
      if (!hit) continue;
      hitPoint.copy(o).addScaledVector(d, hit.distance).applyMatrix4(instance.matrix);
      const worldDistance = Math.hypot(hitPoint.x - origin[0], hitPoint.y - origin[1], hitPoint.z - origin[2]);
      if (worldDistance > nearest) continue;
      nearest = worldDistance;
      normal.fromArray(hit.normal).applyMatrix3(instance.normalMatrix).normalize();
      result = {point: hitPoint.toArray(), normal: normal.toArray(), objectName: instance.source.name,
        category: instance.source.category, instanceId: instance.instanceId, distanceModelUnits: worldDistance};
      if (firstOnly) return result;
    }
    return result;
  }
  function sunlightAt({point, date}) {
    ensureAlive(); const p = pointArray(point), solar = solarPosition(date);
    if (solar.apparentElevation <= 0) return {point: p, sunlit: false, reason: 'below-horizon', solar, blocker: null};
    const ray = direction(solar.azimuth, solar.apparentElevation);
    const origin = p.map((value, axis) => value + ray[axis] * EPSILON);
    const blocker = intersect(origin, ray, true);
    return {point: p, sunlit: !blocker, reason: blocker ? 'building-shadow' : 'sun', solar, blocker};
  }
  function pick(raycaster) {
    ensureAlive();
    if (!raycaster?.ray) throw new TypeError('pick requires a Three.js Raycaster');
    const origin = raycaster.ray.origin.toArray(), ray = raycaster.ray.direction.toArray();
    const near = Math.max(0, raycaster.near ?? 0), far = raycaster.far ?? Infinity;
    const surface = intersect(origin.map((value, axis) => value + ray[axis] * near), ray, false, far - near);
    if (surface) surface.distanceModelUnits += near;
    let ground = null;
    if (ray[1] < -1e-9) {
      const distance = -origin[1] / ray[1];
      if (distance >= near && distance <= far) ground = {
        point: origin.map((value, axis) => value + ray[axis] * distance), normal: [0, 1, 0],
        objectName: 'Плоскость участка (y=0)', category: 'Участок', instanceId: null,
        distanceModelUnits: distance, fallbackGround: true,
      };
    }
    return ground && (!surface || ground.distanceModelUnits < surface.distanceModelUnits) ? ground : surface;
  }
  async function day({point, day: selectedDay, stepMinutes = 5, signal, onProgress}) {
    ensureAlive(); abort(signal);
    const p = pointArray(point);
    if (!Number.isFinite(stepMinutes) || stepMinutes <= 0 || stepMinutes > 60) throw new RangeError('stepMinutes must be > 0 and <= 60');
    moscowDate(selectedDay, 0); // Validate before starting any work.
    const started = now(), samples = [], intervals = []; let deadline = now() + SLICE_MS;
    await prepare({signal});
    ensureAlive(); abort(signal); deadline = now() + SLICE_MS;
    const sample = minutes => {
      const result = sunlightAt({point: p, date: moscowDate(selectedDay, minutes)});
      return {minutes, sunlit: result.sunlit, reason: result.reason, azimuth: result.solar.azimuth,
        elevation: result.solar.apparentElevation, blocker: result.blocker?.objectName ?? null};
    };
    const append = (start, end) => {
      if (end - start < 1e-7) return;
      const last = intervals.at(-1);
      if (last && Math.abs(last.end - start) < 1e-6) last.end = end; else intervals.push({start, end});
    };
    let previous = sample(0); samples.push(previous);
    for (let minute = Math.min(stepMinutes, 1440); minute <= 1440; minute = Math.min(minute + stepMinutes, 1440)) {
      ensureAlive(); abort(signal);
      const current = sample(minute); samples.push(current);
      if (previous.sunlit && current.sunlit) append(previous.minutes, minute);
      else if (previous.sunlit !== current.sunlit) {
        let a = previous.minutes, b = minute;
        while (b - a > .5) {
          abort(signal); const mid = (a + b) / 2;
          if (sample(mid).sunlit === previous.sunlit) a = mid; else b = mid;
        }
        const boundary = (a + b) / 2;
        if (previous.sunlit) append(previous.minutes, boundary); else append(boundary, minute);
      }
      previous = current;
      onProgress?.({phase: 'day', fraction: minute / 1440, completed: minute, total: 1440, day: selectedDay});
      if (now() > deadline) {await yieldFrame(); ensureAlive(); abort(signal); deadline = now() + SLICE_MS;}
      if (minute === 1440) break;
    }
    ensureAlive(); abort(signal);
    const sunlightMinutes = intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
    const astronomical = daylight(selectedDay);
    return {point: p, day: selectedDay, timeZone: location.timeZone, stepMinutes, sunlightMinutes,
      sunlightHours: sunlightMinutes / 60, intervals, samples, daylightMinutes: astronomical.durationMinutes,
      temporalResolution: {sampleStepMinutes: stepMinutes, transitionRefinementSeconds: 30,
        limitation: 'Intervals shorter than one sample step can be missed; this is numerical sampling, not continuous certification.'},
      assumptions: {...metadata}, elapsedMilliseconds: now() - started};
  }
  async function year({point, year: selectedYear, dayOfMonth = 21, stepMinutes = 10, signal, onProgress}) {
    ensureAlive(); abort(signal);
    if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > 2100) throw new RangeError('Year must be an integer from 1900 to 2100');
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw new RangeError('dayOfMonth must be 1–31');
    const p = pointArray(point), months = [], started = now();
    for (let month = 1; month <= 12; month++) {
      ensureAlive(); abort(signal);
      const monthDay = Math.min(dayOfMonth, new Date(Date.UTC(selectedYear, month, 0)).getUTCDate());
      const selectedDay = `${selectedYear}-${String(month).padStart(2, '0')}-${String(monthDay).padStart(2, '0')}`;
      const result = await day({point: p, day: selectedDay, stepMinutes, signal,
        onProgress: event => onProgress?.({...event, phase: 'year', month, fraction: (month - 1 + event.fraction) / 12})});
      months.push(result); await yieldFrame(); ensureAlive(); abort(signal);
    }
    return {point: p, year: selectedYear, requestedDayOfMonth: dayOfMonth, months,
      meaning: 'Twelve selected calendar days, not annual total sunlight', elapsedMilliseconds: now() - started};
  }
  return {
    sunlightAt, pick, day, year, prepare, describeOccluders,
    dispose() {if (disposed) return; disposed = true; geometryCache.clear(); instances.length = 0; sources.length = 0;},
  };
  function describeOccluders() {ensureAlive(); return {...metadata, bvhGeometries: geometryCache.size, bvhMilliseconds};}
}
