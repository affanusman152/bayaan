/* Tiny zero-dependency static server:  node serve.js  →  http://localhost:5173
   Opening index.html straight off the disk works, but serving it over http
   lets the logo's black background get keyed out at load (see js/logo.js). */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico' : 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);

  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + rel); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

// if the port is taken, walk up until one is free rather than dying
let port = Number(PORT);
server.on('error', err => {
  if (err.code !== 'EADDRINUSE' || port > Number(PORT) + 20) throw err;
  console.log(`port ${port} busy, trying ${port + 1}…`);
  server.listen(++port);
});
server.on('listening', () => console.log(`\n  Bayaan → http://localhost:${port}\n`));
server.listen(port);
