/**
 * Local preview/e2e server: serves the built web app and emulates the Apps Script web app at /exec
 * (same request/response contract as script.google.com/macros/s/…/exec).
 *   npx tsx tests/dev-server.ts   → http://localhost:8090
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
import { createGas } from './gas-emulator.js';

const port = Number(process.env.PORT || 8090);
const webDir = path.resolve(HERE, '../dist/web');
const gas = createGas({ adminPassword: process.env.ADMIN_PASSWORD || 'Admin-E2E-2026' });
const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${port}`);
  if (url.pathname === '/exec' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let out: any;
      try { out = gas.handle(JSON.parse(body)); } catch { out = { status: 400, error: { code: 'invalid_json', message: 'Malformed JSON' } }; }
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  if (url.pathname === '/__seed' && req.method === 'POST') { const n = gas.sandbox.seedDemoCatalog(); res.end(JSON.stringify({ added: n })); return; }
  if (url.pathname === '/config.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(`window.AURIX_CONFIG = { API_URL: 'http://localhost:${port}/exec' };`); return; }
  let file = path.join(webDir, decodeURIComponent(url.pathname));
  if (!file.startsWith(webDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(webDir, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`AURIX preview (emulated Google Sheets backend) on http://localhost:${port}`));
