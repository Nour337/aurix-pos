/**
 * Transport to the Google Apps Script backend (Google Sheets is the database).
 * Every call is a POST with a text/plain JSON body (no CORS pre-flight); the session token travels in the body.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) { super(message); }
}

type Q = Record<string, string | number | boolean | undefined | null>;
export function qs(q?: Q) {
  if (!q) return '';
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
}

const TOKEN_KEY = 'aurix.token';
const URL_KEY = 'aurix.apiUrl';
const safe = <T,>(f: () => T, d: T) => { try { return f(); } catch { return d; } };
export const getToken = () => safe(() => localStorage.getItem(TOKEN_KEY), null);
export const setToken = (t: string | null) => safe(() => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)), undefined);
export function getApiUrl(): string {
  const fromConfig = (window as any).AURIX_CONFIG?.API_URL as string | undefined;
  return (safe(() => localStorage.getItem(URL_KEY), null) || fromConfig || '').trim();
}
export const setApiUrl = (u: string) => safe(() => (u ? localStorage.setItem(URL_KEY, u.trim()) : localStorage.removeItem(URL_KEY)), undefined);
export const isValidApiUrl = (u: string) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u.trim()) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u.trim());

let onUnauthenticated: (() => void) | null = null;
export const setUnauthenticatedHandler = (f: () => void) => { onUnauthenticated = f; };

const clean = (q?: Q) => Object.fromEntries(Object.entries(q || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]));

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Q; timeoutMs?: number } = {}): Promise<T> {
  const url = getApiUrl();
  if (!url) throw new ApiError(0, 'not_configured', 'Backend URL is not configured');
  const method = opts.method || (opts.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ method, path, query: clean(opts.query), body: opts.body ?? {}, token: getToken() }),
    });
  } catch (e: any) {
    throw new ApiError(0, 'network', e?.message || 'Network error');
  }
  const json: any = await res.json().catch(() => null);
  if (!json) throw new ApiError(res.status || 0, 'network', 'Unexpected response from the backend');
  if (json.error) {
    const err = new ApiError(json.status || 500, json.error.code || 'error', json.error.message || 'Error', json.error.details);
    if (json.status === 401 && !path.startsWith('/auth/login')) { setToken(null); onUnauthenticated?.(); }
    throw err;
  }
  if (json.data && typeof json.data === 'object' && typeof json.data.token === 'string') setToken(json.data.token);
  return json.data as T;
}

export const get = <T = any>(path: string, query?: Q) => api<T>(path, { query });
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });

/** CSV export: the backend returns the file text; the browser saves it. */
export async function downloadExport(entity: string, query?: Q) {
  const r = await get<{ filename: string; csv: string }>(`/admin/export/${entity}`, query);
  const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = r.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const newTxnId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
