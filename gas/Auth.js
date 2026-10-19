// ─────────────────────────────── permissions ───────────────────────────────
var ALL_PERMS = ['pos.sell', 'sales.view_own', 'receipts.print', 'shifts.own', 'sales.view_all', 'discount.apply', 'returns.process', 'expenses.create', 'products.view_cost',
  'products.manage', 'inventory.manage', 'purchases.manage', 'sales.cancel', 'reports.view', 'expenses.manage', 'shifts.manage', 'users.manage', 'audit.view',
  'settings.manage', 'sync.manage', 'export.data'];
var GRANTABLE = ['sales.view_all', 'discount.apply', 'returns.process', 'expenses.create', 'products.view_cost'];
var CASHIER_BASE = ['pos.sell', 'sales.view_own', 'receipts.print', 'shifts.own'];
function effectivePerms(role, extra) {
  if (role === 'manager') return ALL_PERMS.slice();
  var out = CASHIER_BASE.slice();
  (extra || []).forEach(function (p) { if (GRANTABLE.indexOf(p) >= 0 && out.indexOf(p) < 0) out.push(p); });
  return out;
}
function can(user, p) { return !!user && user.permissions.indexOf(p) >= 0; }
function requirePerm(user) {
  var perms = Array.prototype.slice.call(arguments, 1);
  if (!user) throw new AppError(401, 'unauthenticated');
  if (!perms.some(function (p) { return can(user, p); })) throw forbidden('forbidden', 'Missing permission: ' + perms.join(' or '));
}
function authUser(row) {
  return { id: row.id, username: row.username, display_name: row.display_name, role: row.role, permissions: effectivePerms(row.role, row.permissions || []),
    max_discount_pct: row.role === 'manager' ? 100 : row.max_discount_pct, must_change_password: !!row.must_change_password };
}

// ─────────────────────────────── passwords & tokens ───────────────────────────────
var PW_ITER = 1000;
function props() { return PropertiesService.getScriptProperties(); }
function b64(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }
function hmac(msg, key) { return Utilities.computeHmacSha256Signature(msg, key); }
function hashPassword(pw) {
  var salt = Utilities.getUuid();
  return 'h1$' + PW_ITER + '$' + salt + '$' + derive(pw, salt, PW_ITER);
}
function derive(pw, salt, iter) {
  var h = hmac(salt, pw);
  for (var i = 1; i < iter; i++) h = Utilities.computeHmacSha256Signature(h, Utilities.newBlob(pw).getBytes());
  return b64(h);
}
function verifyPassword(pw, stored) {
  if (!stored) { derive(pw, 'dummy-salt', PW_ITER); return false; }
  var p = stored.split('$');
  if (p.length !== 4) return false;
  var got = derive(pw, p[2], Number(p[1]));
  if (got.length !== p[3].length) return false;
  var diff = 0; for (var i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ p[3].charCodeAt(i);
  return diff === 0;
}
function passwordProblems(pw) {
  if (pw.length < 8) return 'password_too_short';
  if (pw.length > 128) return 'password_too_long';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'password_needs_letter_and_digit';
  return null;
}
function setPasswordHash(userId, pw) { props().setProperty('pw:' + userId, hashPassword(pw)); }
function secret() {
  var s = props().getProperty('session_secret');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props().setProperty('session_secret', s); }
  return s;
}
function tokenVersion(userId) { return parseInt(props().getProperty('tv:' + userId) || '1', 10); }
function bumpTokenVersion(userId) { props().setProperty('tv:' + userId, String(tokenVersion(userId) + 1)); }
var SESSION_MS = 7 * 24 * 3600 * 1000;
function issueToken(userId) {
  var payload = b64(Utilities.newBlob(JSON.stringify({ u: userId, v: tokenVersion(userId), e: Date.now() + SESSION_MS })).getBytes());
  return payload + '.' + b64(hmac(payload, secret()));
}
function readToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  var parts = token.split('.');
  if (b64(hmac(parts[0], secret())) !== parts[1]) return null;
  var data;
  try { data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString()); } catch (e) { return null; }
  if (!data || data.e < Date.now() || data.v !== tokenVersion(data.u)) return null;
  return data.u;
}

// brute-force protection (CacheService, shared by all executions)
function checkLock(key) {
  var c = CacheService.getScriptCache().get('lock:' + key);
  if (c) throw new AppError(429, 'too_many_attempts', 'Too many failed attempts. Try again later.');
}
function recordFail(key, max, lockSec) {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('fail:' + key) || '0', 10) + 1;
  if (n >= max) { cache.put('lock:' + key, '1', lockSec); cache.remove('fail:' + key); }
  else cache.put('fail:' + key, String(n), lockSec);
}
function clearFails(key) { CacheService.getScriptCache().remove('fail:' + key); }

/** On-the-spot manager override; returns approving manager id or throws. */
function verifyManagerApproval(approval) {
  if (!approval || !approval.username || !approval.password) throw forbidden('manager_approval_required', 'Manager approval is required for this operation');
  var key = 'approve:' + String(approval.username).toLowerCase();
  checkLock(key);
  var u = T('Users').find(function (r) { return r.username.toLowerCase() === String(approval.username).toLowerCase() && r.active && r.role === 'manager'; });
  var ok = verifyPassword(String(approval.password), u ? props().getProperty('pw:' + u.id) : null) && !!u;
  if (!ok) { recordFail(key, 5, 300); throw forbidden('manager_approval_invalid', 'Manager credentials are invalid'); }
  clearFails(key);
  return u;
}

function audit(user, action, entity, entityId, details) {
  T('AuditLogs').insert({ id: newId('aud'), created_at: nowIso(), user_id: user ? user.id : '', username: user ? user.username : '', action: action,
    entity: entity || '', entity_id: entityId || '', details: JSON.stringify(details || {}).slice(0, 4000) });
}

function createUserRecord(u) {
  var id = newId('usr'); var t = nowIso();
  T('Users').insert({ id: id, username: u.username, display_name: u.display_name, role: u.role, permissions: u.permissions || [], max_discount_pct: u.max_discount_pct || 0,
    active: true, must_change_password: !!u.must_change_password, created_at: t, updated_at: t, last_login_at: '' });
  setPasswordHash(id, u.password);
  return id;
}
function safeUser(r) {
  return { id: r.id, username: r.username, display_name: r.display_name, role: r.role, permissions: r.permissions || [], max_discount_pct: r.max_discount_pct,
    active: !!r.active, must_change_password: !!r.must_change_password, created_at: r.created_at, last_login_at: r.last_login_at || null };
}

// ─────────────────────────────── auth & users routes ───────────────────────────────
function login(rq) {
  var b = rq.body;
  var username = req(b.username, 'username', 64); var pw = req(b.password, 'password', 128);
  var key = 'login:' + username.toLowerCase();
  checkLock(key);
  var u = T('Users').find(function (r) { return r.username.toLowerCase() === username.toLowerCase(); });
  var ok = verifyPassword(pw, u ? props().getProperty('pw:' + u.id) : null) && u && u.active;
  if (!ok) {
    recordFail(key, 5, 300);
    audit(null, 'auth.login_failed', 'Users', u ? u.id : '', { username: username });
    flush();
    throw new AppError(401, 'invalid_credentials', 'Invalid username or password');
  }
  clearFails(key);
  T('Users').update(u.id, { last_login_at: nowIso() });
  audit(authUser(u), 'auth.login', 'Users', u.id);
  return { token: issueToken(u.id), user: authUser(u), settings: publicSettings() };
}
function changePassword(rq) {
  if (!rq.user) throw new AppError(401, 'unauthenticated');
  var cur = req(rq.body.current, 'current', 128); var next = req(rq.body.next, 'next', 128);
  var key = 'chpw:' + rq.user.id; checkLock(key);
  if (!verifyPassword(cur, props().getProperty('pw:' + rq.user.id))) { recordFail(key, 5, 300); throw bad('wrong_password', 'Current password is incorrect'); }
  var prob = passwordProblems(next); if (prob) throw bad(prob);
  if (cur === next) throw bad('password_unchanged');
  setPasswordHash(rq.user.id, next);
  bumpTokenVersion(rq.user.id); // signs out every other device
  T('Users').update(rq.user.id, { must_change_password: false, updated_at: nowIso() });
  audit(rq.user, 'auth.password_changed', 'Users', rq.user.id);
  return { ok: true, token: issueToken(rq.user.id) };
}
function usersCreate(rq) {
  requirePerm(rq.user, 'users.manage');
  var b = rq.body;
  var username = req(b.username, 'username', 32);
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) throw bad('validation_error', 'Invalid input', [{ path: 'username', message: 'username_format' }]);
  var role = oneOf(b.role, ['manager', 'cashier'], 'role');
  var pw = req(b.password, 'password', 128); var prob = passwordProblems(pw); if (prob) throw bad(prob);
  if (T('Users').find(function (r) { return r.username.toLowerCase() === username.toLowerCase(); })) throw conflict('duplicate_username');
  var perms = (b.permissions || []).filter(function (p) { return GRANTABLE.indexOf(p) >= 0; });
  var id = createUserRecord({ username: username, display_name: req(b.display_name, 'display_name', 60), role: role, password: pw, permissions: perms,
    max_discount_pct: b.max_discount_pct ? int(b.max_discount_pct, 'max_discount_pct', 0, 100) : 0, must_change_password: true });
  audit(rq.user, 'user.create', 'Users', id, { username: username, role: role, permissions: perms });
  return safeUser(T('Users').get(id));
}
function usersPatch(rq) {
  requirePerm(rq.user, 'users.manage');
  var cur = T('Users').get(rq.params.id); if (!cur) throw notFound();
  var b = rq.body;
  var demoting = (b.role && b.role !== 'manager') || b.active === false;
  if (cur.role === 'manager' && demoting && !T('Users').find(function (r) { return r.role === 'manager' && r.active && r.id !== cur.id; })) throw conflict('last_manager', 'At least one active manager is required');
  if (b.reset_password) { var p = passwordProblems(String(b.reset_password)); if (p) throw bad(p); }
  var patch = { updated_at: nowIso() };
  if (b.display_name !== undefined) patch.display_name = req(b.display_name, 'display_name', 60);
  if (b.role !== undefined) patch.role = oneOf(b.role, ['manager', 'cashier'], 'role');
  if (b.permissions !== undefined) patch.permissions = b.permissions.filter(function (p) { return GRANTABLE.indexOf(p) >= 0; });
  if (b.max_discount_pct !== undefined) patch.max_discount_pct = int(Number(b.max_discount_pct), 'max_discount_pct', 0, 100);
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.reset_password) { setPasswordHash(cur.id, String(b.reset_password)); patch.must_change_password = true; }
  if (b.active === false || b.reset_password || b.role) bumpTokenVersion(cur.id);
  T('Users').update(cur.id, patch);
  var logged = JSON.parse(JSON.stringify(b)); delete logged.reset_password; logged.password_reset = !!b.reset_password;
  audit(rq.user, 'user.update', 'Users', cur.id, logged);
  return safeUser(T('Users').get(cur.id));
}
