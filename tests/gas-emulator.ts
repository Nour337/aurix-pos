/**
 * Runs the real Apps Script backend (gas/*.js) inside Node with in-memory fakes of the Google services
 * it uses (SpreadsheetApp, PropertiesService, LockService, CacheService, Utilities, DriveApp…).
 * Lets the acceptance tests and the browser e2e run against the exact code that is deployed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
import vm from 'node:vm';
import { createHash, createHmac, randomUUID } from 'node:crypto';

export const GAS_FILES = ['Code.js', 'Auth.js', 'Inventory.js', 'Sales.js', 'Shifts.js', 'Reports.js', 'Admin.js', 'Main.js'];
const gasDir = path.resolve(HERE, '../gas');
export const bundleSource = () => GAS_FILES.map((f) => `// ===== ${f} =====\n` + fs.readFileSync(path.join(gasDir, f), 'utf8')).join('\n');

type Cell = string | number | boolean | Date;
const toBuf = (v: any) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(Uint8Array.from((v as number[]).map((b) => b & 255))));
const toSigned = (b: Buffer) => Array.from(new Int8Array(b.buffer, b.byteOffset, b.length));

class FakeRange {
  constructor(private sh: FakeSheet, private r: number, private c: number, private nr: number, private nc: number) {}
  getValues(): Cell[][] {
    const out: Cell[][] = [];
    for (let i = 0; i < this.nr; i++) { const row = this.sh.grid[this.r - 1 + i] || []; const o: Cell[] = []; for (let j = 0; j < this.nc; j++) o.push(row[this.c - 1 + j] ?? ''); out.push(o); }
    return out;
  }
  setValues(v: Cell[][]) {
    if (this.sh.ss.failWrites) throw new Error('Simulated Google Sheets outage');
    if (v.length !== this.nr || v.some((r) => r.length !== this.nc)) throw new Error(`setValues size mismatch ${v.length}x${v[0]?.length} vs ${this.nr}x${this.nc}`);
    this.sh.ss.writeCalls++;
    v.forEach((row, i) => { const target = (this.sh.grid[this.r - 1 + i] ||= []); row.forEach((cell, j) => { target[this.c - 1 + j] = cell; }); });
    return this;
  }
  setNumberFormat() { return this; } setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
}
class FakeSheet {
  grid: Cell[][] = [];
  constructor(public ss: FakeSpreadsheet, public name: string) {}
  getLastRow() { let n = this.grid.length; while (n > 0 && (this.grid[n - 1] || []).every((v) => v === '' || v == null)) n--; return n; }
  getLastColumn() { return Math.max(0, ...this.grid.map((r) => { let n = r.length; while (n > 0 && (r[n - 1] === '' || r[n - 1] == null)) n--; return n; })); }
  getMaxRows() { return Math.max(1000, this.grid.length); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(r: number, c: number, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  setFrozenRows() {}
  /** test helper: rows as objects keyed by header */
  table(): Record<string, Cell>[] { const [h, ...rows] = this.grid; return (rows || []).filter((r) => r && r.some((v) => v !== '')).map((r) => Object.fromEntries((h || []).map((k, i) => [String(k), r[i] ?? '']))); }
}
class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>();
  failWrites = false; writeCalls = 0;
  getSheetByName(n: string) { return this.sheets.get(n) || null; }
  insertSheet(n: string) { const s = new FakeSheet(this, n); this.sheets.set(n, s); return s; }
  getId() { return 'fake-spreadsheet-id'; } getUrl() { return 'https://docs.google.com/spreadsheets/d/fake'; } getName() { return 'AURIX Store Data (emulated)'; }
  table(n: string) { return this.sheets.get(n)?.table() || []; }
}

export function createGas(opts: { adminPassword?: string } = {}) {
  const ss = new FakeSpreadsheet();
  const props = new Map<string, string>();
  const cache = new Map<string, string>();
  const files: any[] = [];
  const folder = { getFiles: () => { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; } };
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date, tz: string, pattern: string) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return pattern.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
  };
  const sandbox: any = {
    console, Logger: { log: () => {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k: string) => (props.has(k) ? props.get(k)! : null), setProperty: (k: string, v: string) => { props.set(k, String(v)); },
      setProperties: (o: Record<string, string>) => Object.entries(o).forEach(([k, v]) => props.set(k, String(v))), deleteProperty: (k: string) => props.delete(k),
    }) },
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => { cache.set(k, v); }, remove: (k: string) => { cache.delete(k); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      formatDate: fmt, getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a: string, s: string) => toSigned(createHash('sha256').update(s, 'utf8').digest()),
      computeHmacSha256Signature: (v: any, k: any) => toSigned(createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()),
      base64EncodeWebSafe: (v: any) => toBuf(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: (s: string) => toSigned(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: (v: any) => ({ getBytes: () => toSigned(toBuf(v)), getDataAsString: () => toBuf(v).toString('utf8') }),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ content: s, setMimeType() { return this; } }) },
    DriveApp: {
      getFoldersByName: () => { let done = false; return { hasNext: () => !done && files.length >= 0 && !done, next: () => { done = true; return folder; } }; },
      createFolder: () => folder,
      getFileById: () => ({ makeCopy: (name: string) => { const f = { getName: () => name, getUrl: () => 'https://drive/' + files.length, getDateCreated: () => new Date(), getSize: () => 1, setTrashed: () => {} }; files.push(f); return f; } }),
    },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => { const b: any = { timeBased: () => b, everyDays: () => b, atHour: () => b, inTimezone: () => b, create: () => ({}) }; return b; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(bundleSource(), sandbox, { filename: 'aurix-gas.js' });
  if (opts.adminPassword) props.set('INITIAL_ADMIN_PASSWORD', opts.adminPassword);
  sandbox.setup();
  return { ss, props, cache, handle: (input: any) => JSON.parse(JSON.stringify(sandbox.handle(input))), sandbox };
}

/** supertest-like client: keeps the session token, returns {status, body}. */
export function gasClient(gas: ReturnType<typeof createGas>) {
  let token: string | null = null;
  const call = (method: string, url: string, body?: any) => {
    const u = new URL(url, 'http://x');
    const query = Object.fromEntries(u.searchParams.entries());
    const res = gas.handle({ method, path: u.pathname.replace(/^\/api/, ''), query, body, token });
    const data = res.error ? { error: res.error } : res.data;
    if (data && typeof data === 'object' && typeof data.token === 'string') token = data.token;
    return Promise.resolve({ status: res.status, body: data, text: typeof data?.csv === 'string' ? data.csv : JSON.stringify(data) });
  };
  return {
    get: (u: string) => call('GET', u), post: (u: string, b?: any) => call('POST', u, b ?? {}), patch: (u: string, b?: any) => call('PATCH', u, b ?? {}), put: (u: string, b?: any) => call('PUT', u, b ?? {}),
    logout: () => { token = null; },
  };
}
