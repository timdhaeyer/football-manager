// Zero-dependency static dev server.
//   node tools/serve.mjs                 → http://localhost:8080 (secure context on localhost)
//   node tools/serve.mjs --https         → https://<LAN-IP>:8443 using certs/cert.pem + certs/key.pem (mkcert)
//   PORT=9000 node tools/serve.mjs
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const https = process.argv.includes('--https');
const port = Number(process.env.PORT) || (https ? 8443 : 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

let server;
if (https) {
  const cert = join(root, 'certs', 'cert.pem');
  const key = join(root, 'certs', 'key.pem');
  if (!existsSync(cert) || !existsSync(key)) {
    console.error('Missing certs/cert.pem and certs/key.pem. See README → "Testing on the iPhone over LAN HTTPS".');
    process.exit(1);
  }
  server = createHttps({ cert: readFileSync(cert), key: readFileSync(key) }, handler);
} else {
  server = createHttp(handler);
}

server.listen(port, '0.0.0.0', () => {
  const scheme = https ? 'https' : 'http';
  console.log(`Football Manager dev server: ${scheme}://localhost:${port}/`);
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) console.log(`  LAN: ${scheme}://${a.address}:${port}/`);
  }
  console.log('  Debug speed: Settings → Debug. Service worker is off on localhost unless you add ?sw=1.');
});
