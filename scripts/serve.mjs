import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const mimeTypes = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8'
}));
const project = fileURLToPath(new URL('../', import.meta.url));

export async function startServer({directory = path.join(project, 'dist'), basePath = '/r_peredelkino/', port = 0, host = '127.0.0.1'} = {}) {
  const root = await realpath(directory);
  const base = '/' + basePath.replace(/^\/+|\/+$/g, '') + '/';
  const mount = base === '//' ? '/' : base;
  if (mount.includes('..') || /[\\?#%\0]/.test(mount)) throw new Error('Invalid base path');
  const server = createServer(async (req, res) => {
    const fail = (status, message) => { res.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff'}); res.end(req.method === 'HEAD' ? '' : message); };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); fail(405, 'Method not allowed'); return; }
    let requested;
    try { requested = decodeURIComponent((req.url || '/').split('?')[0]); } catch { fail(400, 'Invalid URL encoding'); return; }
    if (/[\\\0]/.test(requested) || requested.split('/').some(part => part === '.' || part === '..')) { fail(400, 'Invalid path'); return; }
    if (requested === '/' && mount !== '/' || requested === mount.slice(0, -1)) {
      res.writeHead(302, {Location: mount}); res.end(); return;
    }
    if (!requested.startsWith(mount)) { fail(404, 'Not found'); return; }
    const relative = requested.slice(mount.length);
    let absolute = path.resolve(root, relative || 'index.html');
    if (absolute !== root && !absolute.startsWith(root + path.sep)) { fail(403, 'Forbidden'); return; }
    try {
      let metadata = await stat(absolute);
      if (metadata.isDirectory()) {
        if (!requested.endsWith('/')) {
          res.writeHead(301, {Location: requested.split('/').map(encodeURIComponent).join('/') + '/'}); res.end(); return;
        }
        absolute = path.join(absolute, 'index.html'); metadata = await stat(absolute);
      }
      if (!metadata.isFile()) { fail(404, 'Not found'); return; }
      const resolved = await realpath(absolute);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) { fail(403, 'Forbidden'); return; }
      const etag = `"${metadata.size.toString(16)}-${Math.floor(metadata.mtimeMs).toString(16)}"`;
      const headers = {'Content-Type': mimeTypes.get(path.extname(absolute).toLowerCase()) || 'application/octet-stream', 'Content-Length': metadata.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ETag: etag};
      if (req.headers['if-none-match'] === etag) { delete headers['Content-Length']; res.writeHead(304, headers); res.end(); return; }
      res.writeHead(200, headers);
      if (req.method === 'HEAD') res.end();
      else createReadStream(resolved).on('error', () => res.destroy()).pipe(res);
    } catch (error) { fail(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, 'Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return {server, basePath: mount, url: `http://${host}:${server.address().port}${mount}`};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {directory: path.join(project, 'dist'), basePath: process.env.BASE_PATH || '/r_peredelkino/', port: Number(process.env.PORT || 4173), host: process.env.HOST || '127.0.0.1'};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = {'--dir': 'directory', '--base': 'basePath', '--port': 'port', '--host': 'host'}[args[i]];
    if (!key || !args[i + 1]) throw new Error('Usage: node scripts/serve.mjs [--dir dist|.pages] [--base /r_peredelkino/] [--port 4173] [--host 127.0.0.1]');
    options[key] = key === 'directory' ? path.resolve(project, args[i + 1]) : key === 'port' ? Number(args[i + 1]) : args[i + 1];
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('Invalid port');
  const {server, url} = await startServer(options);
  console.log(`Rodina concept: ${url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
}
