import {cp, lstat, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'dist');
const target = path.join(root, '.pages');
if (!(await readFile(path.join(source, 'index.html'), 'utf8')).includes('type="importmap"')) {
  throw new Error('The canonical dist/index.html and its local Three.js import map are required');
}
let count = 0, bytes = 0;
async function inspect(dir) {
  for (const name of await readdir(dir)) {
    const absolute = path.join(dir, name), stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Pages artifacts must not contain symbolic links: ${absolute}`);
    if (stat.isDirectory()) await inspect(absolute);
    else if (stat.isFile() && name !== '.DS_Store') { count++; bytes += stat.size; }
    else if (!stat.isFile()) throw new Error(`Unsupported entry in dist: ${absolute}`);
  }
}
await inspect(source);
// .pages is a generated directory owned exclusively by this script.
await rm(target, {recursive: true, force: true});
await mkdir(target, {recursive: true});
await cp(source, target, {recursive: true, filter: absolute => path.basename(absolute) !== '.DS_Store'});
await writeFile(path.join(target, '.nojekyll'), '');
console.log(`Built .pages from canonical dist: ${count} files, ${bytes} bytes; project-relative URLs preserved`);
