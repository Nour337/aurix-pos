// ─────────────────────────────── setup ───────────────────────────────
/** Safe to run any number of times: creates missing tabs/headers, never clears data. */
function ensureTabs() {
  var ss = getSS(); var created = []; var headersAdded = {};
  TAB_ORDER.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var width = Math.max(sh.getLastColumn(), 1);
    var existing = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); }) : [];
    while (existing.length && existing[existing.length - 1] === '') existing.pop();
    var missing = SCHEMA[name].map(function (c) { return c[0]; }).filter(function (h) { return existing.indexOf(h) < 0; });
    if (missing.length) {
      sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      headersAdded[name] = missing;
    }
    var header = existing.concat(missing);
    // plain-text format for text columns stops Sheets from turning SKUs/dates/phones into numbers or formulas
    SCHEMA[name].forEach(function (c) {
      var col = header.indexOf(c[0]) + 1;
      var fmt = c[2] === 'm' || c[2] === 'mn' ? '0.00' : c[2] === 'n' ? '0' : c[2] === 'b' ? null : '@';
      if (fmt) sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat(fmt);
    });
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#10265C').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  });
  resetDb();
  return { created: created, headersAdded: headersAdded };
}

/** Run once from the Apps Script editor. Creates tabs, the first manager and the daily backup trigger. */
function setup() {
  var r = ensureTabs();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    resetDb();
    var msg = 'Tabs ready. Created: ' + (r.created.join(', ') || 'none') + '.';
    if (!T('Users').all().length) {
      var pw = props().getProperty('INITIAL_ADMIN_PASSWORD') || ('Aurix-' + Utilities.getUuid().slice(0, 8) + '7');
      createUserRecord({ username: 'admin', display_name: 'Manager', role: 'manager', password: pw, must_change_password: true });
      audit(null, 'setup.first_manager', 'Users', '', {});
      flush();
      msg += ' First manager → username: admin  temporary password: ' + pw + '  (you must change it at first login)';
    }
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyBackup'; })) {
      ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(3).inTimezone(TZ).create();
      msg += ' Daily backup trigger installed.';
    }
    Logger.log(msg);
    return msg;
  } finally { lock.releaseLock(); }
}

/** Emergency: reset a user's password from the editor. Edit the two values, run, then undo the edit. */
function resetPasswordFromEditor() {
  var USERNAME = 'admin', NEW_PASSWORD = 'Change-Me-123';
  var u = T('Users').find(function (r) { return r.username === USERNAME; });
  if (!u) throw new Error('No such user');
  setPasswordHash(u.id, NEW_PASSWORD); bumpTokenVersion(u.id);
  T('Users').update(u.id, { must_change_password: true, active: true }); flush();
  Logger.log('Password reset for ' + USERNAME);
}

// ─────────────────────────────── settings routes ───────────────────────────────
function settingsGet(rq) { return rq.user && can(rq.user, 'settings.manage') ? getSettings() : publicSettings(); }
function settingsPatch(rq) {
  requirePerm(rq.user, 'settings.manage');
  var b = rq.body || {}; var allowed = Object.keys(DEFAULT_SETTINGS).filter(function (k) { return k !== 'currency'; });
  Object.keys(b).forEach(function (k) {
    if (allowed.indexOf(k) < 0) return;
    var v = b[k];
    if (k === 'pos.payment_methods') { v = (v || []).filter(function (m) { return PAYMENT_METHODS.indexOf(m) >= 0; }); if (!v.length) throw bad('validation_error', 'Invalid input', [{ path: k }]); }
    else if (k === 'expenses.categories') { v = (v || []).map(function (x) { return str(x, 40); }).filter(Boolean); if (!v.length) throw bad('validation_error', 'Invalid input', [{ path: k }]); }
    else if (k === 'receipt.width') v = oneOf(String(v), ['58', '80'], k);
    else if (/^(inventory|returns)\./.test(k)) v = int(Number(v), k, 0, 1000);
    else v = str(v, 200);
    setSetting(k, v);
  });
  audit(rq.user, 'settings.update', 'Settings', '', b);
  flush(); resetDb();
  return getSettings();
}

// ─────────────────────────────── router ───────────────────────────────
var ROUTES = [
  ['GET', '/health', function () { return { ok: true, app: 'AURIX POS', version: VERSION, time: nowIso() }; }, true],
  ['POST', '/auth/login', login, true],
  ['POST', '/auth/logout', function () { return { ok: true }; }, true],
  ['GET', '/auth/me', function (rq) { if (!rq.user) throw new AppError(401, 'unauthenticated'); return { user: rq.user, settings: publicSettings() }; }, true],
  ['POST', '/auth/change-password', changePassword, true],
  ['GET', '/settings', settingsGet], ['PATCH', '/settings', settingsPatch],
  ['GET', '/users', function (rq) { requirePerm(rq.user, 'users.manage'); return { rows: T('Users').all().map(safeUser).sort(function (a, b) { return (b.active - a.active) || a.role.localeCompare(b.role) || a.display_name.localeCompare(b.display_name); }) }; }],
  ['GET', '/users/basic', function (rq) { requirePerm(rq.user, 'reports.view', 'shifts.manage', 'sales.view_all'); return { rows: T('Users').all().map(function (u) { return { id: u.id, display_name: u.display_name, role: u.role, active: u.active ? 1 : 0 }; }) }; }],
  ['POST', '/users', usersCreate], ['PATCH', '/users/:id', usersPatch],
  ['GET', '/products', productsList], ['GET', '/products/lookup/:code', productsLookup], ['GET', '/products/next-sku', productsNextSku],
  ['GET', '/products/check-unique', productsCheckUnique], ['GET', '/products/:id', productsGet], ['POST', '/products', productsCreate], ['PATCH', '/products/:id', productsPatch],
  ['GET', '/catalog/categories', categoriesList], ['POST', '/catalog/categories', categoriesCreate], ['PATCH', '/catalog/categories/:id', categoriesPatch],
  ['GET', '/catalog/suppliers', suppliersList], ['POST', '/catalog/suppliers', suppliersCreate], ['PATCH', '/catalog/suppliers/:id', suppliersPatch],
  ['GET', '/inventory/alerts', alertsList], ['GET', '/inventory/alerts/summary', alertsSummary], ['POST', '/inventory/alerts/:id/review', alertsReview],
  ['GET', '/inventory/movements', movementsList], ['POST', '/inventory/adjust', inventoryAdjust], ['POST', '/inventory/counts', countsCreate], ['GET', '/inventory/counts', countsList],
  ['GET', '/inventory/overview', inventoryOverview],
  ['GET', '/purchases', purchasesList], ['GET', '/purchases/:id', purchasesGet], ['POST', '/purchases', purchasesCreate],
  ['POST', '/sales/checkout', checkout], ['GET', '/sales', salesList], ['GET', '/sales/by-invoice/:no', salesByInvoice], ['GET', '/sales/:id', salesGet],
  ['POST', '/sales/:id/reprint', salesReprint], ['POST', '/sales/:id/cancel', salesCancel],
  ['POST', '/returns', returnsCreate], ['GET', '/returns', returnsList], ['GET', '/returns/:id', returnsGet],
  ['GET', '/shifts/current', shiftsCurrent], ['POST', '/shifts/open', shiftsOpen], ['POST', '/shifts/:id/cash', shiftsCash], ['POST', '/shifts/:id/close', shiftsClose],
  ['GET', '/shifts', shiftsList], ['GET', '/shifts/:id', shiftsGet],
  ['POST', '/expenses', expensesCreate], ['GET', '/expenses', expensesList], ['POST', '/expenses/:id/void', expensesVoid],
  ['GET', '/reports/summary', reportsSummary], ['GET', '/reports/monthly', reportsMonthly],
  ['GET', '/admin/audit', auditList], ['GET', '/admin/integrity', function (rq) { requirePerm(rq.user, 'settings.manage'); return integrityReport(); }],
  ['GET', '/admin/backups', backupsList], ['POST', '/admin/backups', backupsCreate],
  ['GET', '/admin/sheets', sheetStatus], ['POST', '/admin/sheets/init', sheetInit],
  ['GET', '/admin/export/:entity', exportCsv],
];
var COMPILED = ROUTES.map(function (r) {
  var keys = [];
  var re = new RegExp('^' + r[1].replace(/:(\w+)/g, function (_, k) { keys.push(k); return '([^/]+)'; }) + '$');
  return { method: r[0], re: re, keys: keys, fn: r[2], open: !!r[3] };
});

function handle(input) {
  resetDb();
  var method = String(input.method || 'GET').toUpperCase();
  var path = String(input.path || '/').split('?')[0];
  var route = null, params = {};
  for (var i = 0; i < COMPILED.length; i++) {
    var c = COMPILED[i]; if (c.method !== method) continue;
    var m = path.match(c.re);
    if (m) { route = c; c.keys.forEach(function (k, j) { params[k] = decodeURIComponent(m[j + 1]); }); break; }
  }
  if (!route) return { status: 404, error: { code: 'not_found', message: 'Unknown endpoint ' + method + ' ' + path } };
  var rq = { method: method, path: path, params: params, query: input.query || {}, body: input.body || {}, user: null, status: 200 };
  var lock = null;
  try {
    if (method !== 'GET') { lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) throw new AppError(503, 'busy', 'The system is busy, please retry'); }
    var uid = readToken(input.token);
    if (uid) { var row = T('Users').get(uid); if (row && row.active) rq.user = authUser(row); }
    if (!route.open) {
      if (!rq.user) throw new AppError(401, 'unauthenticated');
      if (rq.user.must_change_password) throw new AppError(403, 'password_change_required');
    }
    var data = route.fn(rq);
    flush(); // validation passed → commit buffered writes
    return { status: rq.status || 200, data: data === undefined ? null : data };
  } catch (e) {
    DB = null; // discard buffered writes
    if (e instanceof AppError) return { status: e.status, error: { code: e.code, message: e.message, details: e.details } };
    console.error(e && e.stack || e);
    return { status: 500, error: { code: 'internal_error', message: String(e && e.message || e) } };
  } finally { if (lock) lock.releaseLock(); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  var input;
  try { input = JSON.parse(e.postData.contents); } catch (err) { return json({ status: 400, error: { code: 'invalid_json', message: 'Malformed JSON' } }); }
  return json(handle(input));
}
function doGet(e) { return json(handle({ method: 'GET', path: (e && e.parameter && e.parameter.path) || '/health', query: e && e.parameter || {} })); }

/** Optional: loads a starter catalog (no sales). Run from the editor or via the dev bridge. Skips existing SKUs. */
function seedDemoCatalog() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    resetDb();
    var admin = T('Users').find(function (u) { return u.role === 'manager'; });
    var user = authUser(admin);
    var cats = [['Body Splash', 'بودي سبلاش'], ['Perfumes', 'عطور'], ['Accessories', 'إكسسوارات'], ['Hair Accessories', 'إكسسوارات شعر'], ['Beauty & Care', 'عناية وجمال']];
    var catId = {};
    cats.forEach(function (c) {
      var ex = T('Categories').find(function (x) { return x.name_en === c[0]; });
      if (ex) { catId[c[0]] = ex.id; return; }
      var id = newId('cat'); catId[c[0]] = id;
      T('Categories').insert({ id: id, name_en: c[0], name_ar: c[1], active: true, created_at: nowIso(), updated_at: nowIso() });
    });
    var sup = T('Suppliers').find(function (s) { return s.name === 'Cairo Beauty Wholesale'; });
    if (!sup) sup = T('Suppliers').insert({ id: newId('sup'), name: 'Cairo Beauty Wholesale', phone: '+20 100 000 0000', email: '', notes: 'Demo supplier', active: true, created_at: nowIso(), updated_at: nowIso() });
    var list = [
      ['AUR-0001', 'Rose Body Splash', 'بودي سبلاش الورد', 100, 150, 5, 'Body Splash', 'fragrance', 'Rose'],
      ['AUR-0002', 'Vanilla Musk Body Splash', 'بودي سبلاش فانيليا مسك', 110, 165, 12, 'Body Splash', 'fragrance', 'Vanilla Musk'],
      ['AUR-0003', 'Coconut Breeze Body Mist', 'بودي ميست جوز الهند', 95, 140, 8, 'Body Splash', 'fragrance', 'Coconut'],
      ['AUR-0004', 'Oud Royale Eau de Parfum 100ml', 'عطر عود رويال ١٠٠مل', 520, 850, 6, 'Perfumes', 'size', '100ml'],
      ['AUR-0005', 'Jasmine Noir Eau de Parfum 50ml', 'عطر ياسمين نوار ٥٠مل', 340, 560, 3, 'Perfumes', 'size', '50ml'],
      ['AUR-0006', 'Amber Gold Perfume Oil', 'زيت عطري عنبر ذهبي', 180, 300, 10, 'Perfumes', 'size', '12ml'],
      ['AUR-0007', 'Gold Hoop Earrings', 'حلق دائري ذهبي', 120, 250, 15, 'Accessories', 'color', 'Gold'],
      ['AUR-0008', 'Pearl Layered Necklace', 'سلسلة لؤلؤ طبقات', 160, 320, 7, 'Accessories', 'color', 'Pearl'],
      ['AUR-0009', 'Crystal Charm Bracelet', 'إسورة كريستال', 90, 190, 9, 'Accessories', 'color', 'Silver'],
      ['AUR-0010', 'Royal Blue Silk Scarf', 'إيشارب حرير أزرق ملكي', 150, 280, 4, 'Accessories', 'color', 'Royal Blue'],
      ['AUR-0011', 'Pearl Hair Clip Set', 'طقم مشابك شعر لؤلؤ', 45, 95, 20, 'Hair Accessories', 'color', 'Pearl'],
      ['AUR-0012', 'Velvet Scrunchies (3 pcs)', 'توك قطيفة (٣ قطع)', 30, 70, 25, 'Hair Accessories', 'color', 'Assorted'],
      ['AUR-0013', 'Shea Butter Hand Cream', 'كريم يد زبدة الشيا', 55, 110, 14, 'Beauty & Care', 'size', '75ml'],
      ['AUR-0014', 'Rose Lip Balm', 'مرطب شفاه بالورد', 25, 60, 2, 'Beauty & Care', 'fragrance', 'Rose'],
      ['AUR-0015', 'Argan Hair Oil', 'زيت أرجان للشعر', 85, 175, 0, 'Beauty & Care', 'size', '50ml'],
    ];
    var n = 0;
    list.forEach(function (x) {
      if (T('Products').find(function (p) { return p.sku === x[0]; })) return;
      var id = newId('prd'); var t = nowIso();
      var rec = { id: id, sku: x[0], barcode: '', name_en: x[1], name_ar: x[2], category_id: catId[x[6]], brand: 'AURIX', cost_price: x[3] * 100, sell_price: x[4] * 100, qty: 0, min_stock: 2,
        supplier_id: sup.id, variant_group: '', size: '', color: '', fragrance: '', expiry_date: '', image_url: '', status: 'active', notes: '', created_at: t, updated_at: t };
      rec[x[7]] = x[8];
      T('Products').insert(rec);
      if (x[5] > 0) applyStockChange({ productId: id, delta: x[5], type: 'initial', user: user, reason: 'Opening stock (demo catalog)', unitCost: x[3] * 100 });
      else evaluateAlert(id);
      n++;
    });
    var cur = parseInt(props().getProperty('counter:sku') || '0', 10);
    if (cur < list.length) props().setProperty('counter:sku', String(list.length));
    audit(user, 'setup.demo_catalog', 'Products', '', { added: n });
    flush();
    Logger.log('Demo catalog: ' + n + ' products added');
    return n;
  } finally { lock.releaseLock(); }
}
