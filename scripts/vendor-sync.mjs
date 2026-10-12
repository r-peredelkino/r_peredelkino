import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/vendor-sync.mjs [--check]');
const expectedVersions = {three: '0.186.1', 'polygon-clipping': '0.15.7'};
const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const [name, version] of Object.entries(expectedVersions)) {
  const installed = JSON.parse(await readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  if (project.dependencies?.[name] !== version || installed.version !== version) {
    throw new Error(`${name}: expected exact ${version}; run npm ci using the committed lockfile`);
  }
}

const files = new Map();
const copy = async (source, target) => files.set(target, await readFile(path.join(root, 'node_modules', source)));
await copy('three/build/three.module.js', 'three.module.js');
await copy('three/build/three.core.js', 'three.core.js');
await copy('three/examples/jsm/controls/OrbitControls.js', 'OrbitControls.js');
await copy('three/LICENSE', 'three.LICENSE.txt');
await copy('polygon-clipping/LICENSE.md', 'polygon-clipping.LICENSE.txt');
// The upstream UMD is self-contained. Keep the existing project's ESM API and
// remove the source-map request because the map is not part of the public app.
const polygon = (await readFile(path.join(root, 'node_modules/polygon-clipping/dist/polygon-clipping.umd.min.js'), 'utf8'))
  .replace(/\n\/\/# sourceMappingURL=[^\r\n]*\r?\n?$/, '');
const adapter = '\n// ES module adapter; upstream polygon-clipping 0.15.7, MIT.\nexport default globalThis.polygonClipping;\n';
files.set('polygon-clipping.module.js', Buffer.from(polygon + adapter));
// splaytree's npm distribution keeps its complete MIT licence in Readme.md,
// rather than publishing a standalone LICENSE file.
const splaytreeReadme = await readFile(path.join(root, 'node_modules/splaytree/Readme.md'), 'utf8');
const splaytreeLicense = splaytreeReadme.match(/^## License\s*\n([\s\S]+)$/m)?.[1];
if (!splaytreeLicense?.includes('Copyright (c) 2019 Alexander Milevski') || !splaytreeLicense.includes('Permission is hereby granted')) {
  throw new Error('Cannot identify the complete upstream splaytree licence');
}
files.set('splaytree.LICENSE.txt', Buffer.from(splaytreeLicense.trim() + '\n'));
await copy('robust-predicates/LICENSE', 'robust-predicates.LICENSE.txt');

const manifest = {
  schemaVersion: 1,
  projectVersion: project.version,
  dependencies: expectedVersions,
  source: 'Unmodified published npm packages; polygon-clipping has only its existing ESM adapter and no source-map trailer.',
  files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  }]))
};
files.set('dependencies.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const vendor = path.join(root, 'dist/vendor');
if (!check) await mkdir(vendor, {recursive: true});
for (const [name, expected] of files) {
  const target = path.join(vendor, name);
  if (check) {
    let actual;
    try { actual = await readFile(target); } catch { throw new Error(`Missing vendored dependency: ${target}`); }
    if (!actual.equals(expected)) throw new Error(`Vendored ${name} differs from the locked npm package; run npm run vendor:sync`);
  } else await writeFile(target, expected);
}
console.log(`${check ? 'Verified' : 'Updated'} ${files.size} vendor files: Three.js ${expectedVersions.three}, polygon-clipping ${expectedVersions['polygon-clipping']}`);
