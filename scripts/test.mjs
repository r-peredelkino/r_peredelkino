import {readFile, readdir, lstat, mkdtemp, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {startServer, mimeTypes} from './serve.mjs';

const project = process.env.RP_PROJECT_DIR || fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !['--assets-only', '--cpu-only'].includes(arg)) || args.length > 1) throw new Error('Usage: node scripts/test.mjs [--assets-only|--cpu-only]');
const suites = [
  ['watermark-cpu', 'tools/qa-v37/watermark-cpu.mjs', 59],
  ['plans-cpu', 'tools/qa-v37/plans-cpu.mjs', 150],
  ['apartment-geometry-cpu', 'tools/qa-v37/apartment-geometry-cpu.mjs', 173],
  ['apartment-actions-cpu', 'tools/qa-v37/apartment-actions-cpu.mjs', 445],
  ['lobby-cpu', 'tools/qa-v36/lobby-cpu.mjs', 53],
  ['club-cpu', 'tools/qa-v36/club-cpu.mjs', 32],
  ['parking-cpu', 'tools/qa-v36/parking-cpu.mjs', 42],
  ['fitness-cpu', 'tools/qa-v36/fitness-cpu.mjs', 44],
  ['fitness-context-cpu', 'tools/qa-v36/fitness-context-cpu.mjs', 18],
  ['cpu-activities', 'tools/qa-v36/cpu-activities.cjs', 7]
];

async function runCPU() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'rodina-cpu-'));
  let total = 0;
  try {
    for (const [name, script, minimum] of suites) {
      const output = path.join(temporary, name); await mkdir(output);
      const stdout = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(project, script)], {cwd: project, env: {...process.env, RP_PROJECT_DIR: project, RP_QA_OUT: output, RP_QA_OUTPUT: path.join(output, name + '.json')}, stdio: ['ignore', 'pipe', 'pipe']});
        let out = '', err = ''; const timeout = setTimeout(() => { child.kill(); reject(new Error(`${name} exceeded five minutes`)); }, 300_000);
        child.stdout.on('data', bytes => out += bytes); child.stderr.on('data', bytes => err += bytes);
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('close', code => { clearTimeout(timeout); code === 0 ? resolve(out) : reject(new Error(`${name} exited ${code}\n${err.slice(-5000)}\n${out.slice(-5000)}`)); });
      });
      let report;
      try { report = JSON.parse(await readFile(path.join(output, name + '.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; report = JSON.parse(stdout.trim()); }
      if (!Array.isArray(report.checks) || report.checks.length < minimum || report.checks.some(check => check.pass !== true) || !(report.pass === true || report.passed === true)) {
        throw new Error(`${name}: incomplete or failing report; expected at least ${minimum} meaningful passing checks`);
      }
      total += report.checks.length;
      console.log(`PASS ${name}: ${report.checks.length} checks`);
    }
    console.log(`PASS CPU: ${total} checks across ${suites.length} suites; reports were written outside the repository`);
  } finally { await rm(temporary, {recursive: true, force: true}); }
}

export async function checkStaticAssets(directory) {
  const entries = new Map(), directories = new Set(['']), errors = [], references = new Map();
  const unix = value => value.split(path.sep).join('/');
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      const absolute = path.join(dir, name), info = await lstat(absolute), relative = unix(path.relative(directory, absolute));
      if (name === '.DS_Store') continue;
      if (info.isSymbolicLink()) { errors.push(`Symbolic link: ${relative}`); continue; }
      if (info.isDirectory()) { directories.add(relative); await walk(absolute); }
      else if (info.isFile()) entries.set(relative, {absolute, size: info.size});
      else errors.push(`Unsupported entry: ${relative}`);
    }
  }
  await walk(directory);
  const isExternal = value => !value || value.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
  function add(value, from, moduleRelative = false) {
    if (isExternal(value) || value.includes('${') || value.includes('`')) return;
    const clean = value.replace(/&amp;/g, '&').split(/[?#]/)[0];
    if (!clean) return;
    if (clean.startsWith('/')) { errors.push(`${from}: root-absolute URL breaks the Pages project base: ${value}`); return; }
    let decoded;
    try { decoded = decodeURIComponent(clean); } catch { errors.push(`${from}: malformed URL ${value}`); return; }
    const target = path.posix.normalize(path.posix.join(moduleRelative ? path.posix.dirname(from) : '', decoded));
    if (target === '..' || target.startsWith('../')) { errors.push(`${from}: reference leaves public dist: ${value}`); return; }
    if (!entries.has(target) && !directories.has(target.replace(/\/$/, ''))) { errors.push(`${from}: missing or incorrectly cased resource ${target}`); return; }
    if (entries.has(target)) {
      if (!references.has(target)) references.set(target, new Set());
      references.get(target).add(from);
    }
  }
  const index = await readFile(path.join(directory, 'index.html'), 'utf8');
  const match = index.match(/<script\b[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) errors.push('Missing local import map in index.html');
  const imports = match ? JSON.parse(match[1]).imports || {} : {};
  for (const value of Object.values(imports)) add(value, 'index.html');
  const resolveModule = (value, from) => {
    if (isExternal(value)) return;
    if (value.startsWith('.') || value.startsWith('/')) add(value, from, true);
    else if (imports[value]) add(imports[value], 'index.html');
    else errors.push(`${from}: unresolved bare module ${value}`);
  };
  const documentedExample = (text, index) => /^(?:\*|\/\/|\/\*)/.test(text.slice(text.lastIndexOf('\n', index) + 1, index).trimStart());
  for (const [relative, info] of entries) {
    const extension = path.extname(relative).toLowerCase();
    if (info.size === 0 && relative !== '.nojekyll') errors.push(`Empty published file: ${relative}`);
    if (!['.js', '.mjs', '.css', '.html', '.json', '.svg'].includes(extension)) continue;
    const text = await readFile(info.absolute, 'utf8');
    if (['.js', '.mjs'].includes(extension)) {
      for (const found of text.matchAll(/\b(?:import\s+(?:[\w*$\s{},]+?\s+from\s*)?|export\s+[\w*$\s{},]+?\s+from\s*)(['"])([^'"\r\n]+)\1/g)) {
        if (!documentedExample(text, found.index)) resolveModule(found[2], relative);
      }
      for (const found of text.matchAll(/\bimport\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g)) {
        if (!documentedExample(text, found.index)) resolveModule(found[2], relative);
      }
      for (const found of text.matchAll(/\bnew\s+URL\(\s*(['"])([^'"\r\n]+)\1\s*,\s*import\.meta\.url\s*\)/g)) add(found[2], relative, true);
    }
    if (['.html', '.svg', '.js', '.mjs'].includes(extension)) {
      for (const found of text.matchAll(/\b(?:src|href|xlink:href|poster)\s*=\s*(['"])([^'"\r\n]*)\1/g)) {
        // HTML embedded in JS is inserted into index.html; standalone SVG/HTML
        // retains its own path as the base for relative attributes.
        add(found[2], relative, ['.html', '.svg'].includes(extension));
      }
    }
    if (extension === '.css') {
      for (const found of text.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g)) add(found[2], relative, true);
      for (const found of text.matchAll(/@import\s+(['"])([^'"\r\n]+)\1/g)) add(found[2], relative, true);
    }
    // Runtime catalogues store asset paths relative to the document. Parse
    // JSON structurally so a documented schema template cannot accidentally
    // exempt an actual image/file record containing the same placeholder.
    if (extension === '.json') {
      let data;
      try { data = JSON.parse(text); }
      catch { errors.push(`${relative}: invalid JSON`); continue; }
      const sourceFloorTemplate = relative === 'assets/reference/source-manifest.json' &&
        data.floorPlans?.localFiles === 'assets/plans/{uuid}.svg' &&
        data.floorPlans?.sourceUrlPattern === 'https://rodina-peredelkino.ru/!upload/t_floor/{uuid}.svg';
      const inspectJSON = (value, keys = []) => {
        if (Array.isArray(value)) value.forEach((item, i) => inspectJSON(item, [...keys, i]));
        else if (value && typeof value === 'object') {
          for (const [key, item] of Object.entries(value)) inspectJSON(item, [...keys, key]);
        } else if (typeof value === 'string' && /^(?:\.\/)?assets\//.test(value)) {
          if (sourceFloorTemplate && keys.length === 2 && keys[0] === 'floorPlans' && keys[1] === 'localFiles' && value === 'assets/plans/{uuid}.svg') return;
          add(value, relative);
        }
      };
      inspectJSON(data);
    } else {
      for (const found of text.matchAll(/(['"`])(?:\.\/)?(assets\/[^'"`\r\n]+)\1/g)) add(found[2], relative);
    }
  }
  // The panorama loader constructs URLs from scene dimensions. Expand its
  // complete preview and detailed tile domain so missing computed URLs are
  // checked as well, rather than checking only files that happen to exist.
  if (entries.has('reference-explorer-data.js')) {
    const source = await readFile(entries.get('reference-explorer-data.js').absolute, 'utf8');
    const json = source.match(/export\s+const\s+referenceExplorerData\s*=\s*(\{[\s\S]*\});?\s*$/)?.[1];
    if (!json) throw new Error('Cannot validate the panorama data module');
    const data = JSON.parse(json);
    for (const scene of data.scenes) {
      const columns = Math.ceil(scene.size / scene.tileSize);
      if (!/^node\d+$/.test(scene.id) || !Number.isInteger(columns) || columns < 1 || columns > 7 || scene.maxLevel !== 3) throw new Error('Unsupported panorama tile domain');
      for (let face = 0; face < 6; face++) {
        add(`assets/panorama/tiles/${scene.id}/cf_${face}/l_0/c_0/tile_0.jpg`, 'reference-explorer-data.js');
        for (let col = 0; col < columns; col++) for (let row = 0; row < columns; row++) {
          add(`assets/panorama/tiles/${scene.id}/cf_${face}/l_${scene.maxLevel}/c_${col}/tile_${row}.jpg`, 'reference-explorer-data.js');
        }
      }
    }
  }
  if (errors.length) {
    const details = [...new Set(errors)];
    const error = new Error(`Static asset validation failed (${details.length})\n${details.slice(0, 40).join('\n')}`);
    error.details = details;
    throw error;
  }

  const {server, url} = await startServer({directory, basePath: '/r_peredelkino/'});
  let checked = 0;
  try {
    const files = [...entries]; let next = 0;
    await Promise.all(Array.from({length: 8}, async () => {
      while (next < files.length) {
        const [relative, info] = files[next++];
        const target = new URL(relative.split('/').map(encodeURIComponent).join('/'), url);
        const response = await fetch(target, {method: 'HEAD'});
        const expectedType = mimeTypes.get(path.extname(relative).toLowerCase()) || 'application/octet-stream';
        if (response.status !== 200 || Number(response.headers.get('content-length')) !== info.size || response.headers.get('content-type') !== expectedType) {
          throw new Error(`HTTP asset failed: ${relative}, status=${response.status}, MIME=${response.headers.get('content-type')}, bytes=${response.headers.get('content-length')}`);
        }
        checked++;
      }
    }));
    for (const requested of ['/r_peredelkino/%2e%2e/package.json', '/r_peredelkino/%2e%2e%2fpackage.json', '/r_peredelkino/%5c..%5cpackage.json']) {
      const status = await new Promise((resolve, reject) => { request(new URL(url).origin + requested, {method: 'HEAD'}, res => { res.resume(); resolve(res.statusCode); }).on('error', reject).end(); });
      if (![400, 403, 404].includes(status)) throw new Error(`Traversal was not blocked: ${requested} (${status})`);
    }
    const base = await fetch(url, {method: 'HEAD'});
    if (base.status !== 200 || !base.headers.get('content-type')?.startsWith('text/html')) throw new Error('Pages base URL does not serve index.html');
  } finally { await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }); }
  console.log(`PASS static assets: ${entries.size} files, ${references.size} explicit resource paths, ${checked} HTTP/MIME/size checks under /r_peredelkino/`);
  return {files: entries.size, resources: references.size, httpChecks: checked};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!args.includes('--assets-only')) await runCPU();
  if (!args.includes('--cpu-only')) await checkStaticAssets(path.join(project, 'dist'));
}
