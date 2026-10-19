// ─────────────────────────────── stock core ───────────────────────────────
/**
 * The ONLY way quantity changes. Runs under the script lock; the check-then-write is therefore atomic
 * with respect to other requests, and selling below zero is impossible.
 */
function applyStockChange(c) {
  if (!c.delta || Math.floor(c.delta) !== c.delta) throw bad('invalid_quantity');
  var p = T('Products').get(c.productId);
  if (!p) throw notFound('product_not_found');
  if (p.qty + c.delta < 0) throw conflict('insufficient_stock', 'Insufficient stock for ' + p.sku, { productId: p.id, sku: p.sku, available: p.qty, requested: -c.delta });
  var before = p.qty;
  T('Products').update(p.id, { qty: before + c.delta, updated_at: nowIso() });
  var id = newId('mov');
  T('StockMovements').insert({ id: id, created_at: nowIso(), product_id: p.id, sku: p.sku, type: c.type, qty_change: c.delta, qty_before: before, qty_after: before + c.delta,
    unit_cost: c.unitCost === undefined ? null : c.unitCost, ref_type: c.refType || '', ref_id: c.refId || '', reason: c.reason || '', user_id: c.user.id, user_name: c.user.display_name });
  return { before: before, after: before + c.delta, movementId: id, alert: evaluateAlert(p.id) };
}

/** One active alert per product; created on crossing the threshold, escalated low→out, auto-resolved on replenishment. */
function evaluateAlert(productId) {
  var p = T('Products').get(productId);
  var level = stockLevel(p.qty, p.min_stock);
  var A = T('InventoryAlerts');
  var active = A.find(function (a) { return a.product_id === productId && (a.status === 'open' || a.status === 'reviewed'); });
  var wanted = level === 'out' ? 'out_of_stock' : level === 'low' ? 'low_stock' : null;
  var t = nowIso();
  if (active && (!wanted || active.type !== wanted || p.status === 'archived')) {
    A.update(active.id, { status: 'resolved', resolved_at: t, resolution: !wanted ? 'replenished' : p.status === 'archived' ? 'archived' : 'escalated_to_' + wanted });
  }
  if (wanted && p.status === 'active' && (!active || active.type !== wanted)) {
    var id = newId('alr');
    A.insert({ id: id, product_id: productId, sku: p.sku, name_en: p.name_en, name_ar: p.name_ar, type: wanted, status: 'open', qty_at_trigger: p.qty, threshold: p.min_stock, created_at: t });
    return { id: id, type: wanted, qty: p.qty };
  }
  return null;
}

function suggestReorder(productId, qty, minStock) {
  var since = addDays(localDate(), -30);
  var sold = sum(T('SaleItems').filter(function (i) { return i.product_id === productId && i.local_date >= since; }), function (i) { return i.qty - i.returned_qty; });
  var days = Number(getSettings()['inventory.reorder_days'] || 30);
  var target = Math.max(Math.ceil((sold / 30) * days), Math.max(minStock * 3, minStock + 3));
  return { suggested: Math.max(1, target - qty), soldLast30: sold };
}

// ─────────────────────────────── products ───────────────────────────────
function catOf(id) { return id ? T('Categories').get(id) : null; }
function presentProduct(p, user) {
  var c = catOf(p.category_id); var s = p.supplier_id ? T('Suppliers').get(p.supplier_id) : null;
  var out = {}; Object.keys(p).forEach(function (k) { if (k !== '_row') out[k] = p[k]; });
  out.barcode = p.barcode || null; out.category_id = p.category_id || null; out.supplier_id = p.supplier_id || null; out.expiry_date = p.expiry_date || null;
  out.category_name_en = c ? c.name_en : null; out.category_name_ar = c ? c.name_ar : null; out.supplier_name = s ? s.name : null;
  out.stock_level = stockLevel(p.qty, p.min_stock);
  if (!can(user, 'products.view_cost')) { delete out.cost_price; delete out.supplier_id; delete out.supplier_name; }
  return out;
}
function generateSku() {
  for (;;) {
    var sku = 'AUR-' + String(nextCounter('sku')).padStart(4, '0');
    if (!T('Products').find(function (p) { return p.sku.toLowerCase() === sku.toLowerCase(); })) return sku;
  }
}
function assertUnique(sku, barcode, exceptId) {
  var P = T('Products');
  if (sku) { var d = P.find(function (p) { return p.id !== exceptId && p.sku.toLowerCase() === String(sku).toLowerCase(); }); if (d) throw conflict('duplicate_sku', 'SKU ' + sku + ' already belongs to "' + d.name_en + '"', { productId: d.id }); }
  if (barcode) { var e = P.find(function (p) { return p.id !== exceptId && (p.barcode === barcode || p.sku.toLowerCase() === String(barcode).toLowerCase()); }); if (e) throw conflict('duplicate_barcode', 'Barcode ' + barcode + ' already belongs to "' + e.name_en + '"', { productId: e.id }); }
}
function productFields(b, partial) {
  var o = {};
  var txt = function (k, max) { if (b[k] !== undefined) o[k] = str(b[k], max); };
  if (b.sku !== undefined && b.sku !== null && b.sku !== '') { o.sku = str(b.sku, 40); if (!/^[A-Za-z0-9._\-/]+$/.test(o.sku)) throw bad('validation_error', 'Invalid input', [{ path: 'sku', message: 'SKU may contain letters, digits, . _ - /' }]); }
  if (b.barcode !== undefined) { o.barcode = str(b.barcode, 64); if (o.barcode && !/^[A-Za-z0-9\-]*$/.test(o.barcode)) throw bad('validation_error', 'Invalid input', [{ path: 'barcode' }]); }
  if (!partial || b.name_en !== undefined) o.name_en = req(b.name_en, 'name_en', 160);
  txt('name_ar', 160); txt('brand', 80); txt('variant_group', 80); txt('size', 40); txt('color', 40); txt('fragrance', 60); txt('notes', 1000);
  if (b.category_id !== undefined) { o.category_id = b.category_id || ''; if (o.category_id && !T('Categories').get(o.category_id)) throw bad('unknown_category'); }
  if (b.supplier_id !== undefined) { o.supplier_id = b.supplier_id || ''; if (o.supplier_id && !T('Suppliers').get(o.supplier_id)) throw bad('unknown_supplier'); }
  if (b.cost_price !== undefined) o.cost_price = int(b.cost_price, 'cost_price', 0, 100000000);
  if (!partial || b.sell_price !== undefined) o.sell_price = int(b.sell_price, 'sell_price', 0, 100000000);
  if (b.min_stock !== undefined) o.min_stock = int(b.min_stock, 'min_stock', 0, 100000);
  if (b.image_url !== undefined) { o.image_url = str(b.image_url, 500); if (o.image_url && !/^https:\/\//.test(o.image_url)) throw bad('validation_error', 'Invalid input', [{ path: 'image_url', message: 'https:// URL' }]); }
  if (b.expiry_date !== undefined) { o.expiry_date = b.expiry_date || ''; if (o.expiry_date && !isYmd(o.expiry_date)) throw bad('validation_error', 'Invalid input', [{ path: 'expiry_date' }]); }
  if (partial && b.status !== undefined) o.status = oneOf(b.status, ['active', 'archived'], 'status');
  return o;
}

function productsList(rq) {
  requirePerm(rq.user, 'pos.sell', 'products.manage');
  var q = rq.query; var term = str(q.q, 100).toLowerCase(); var status = q.status || 'active'; var stock = q.stock || 'all';
  var cats = {}; T('Categories').all().forEach(function (c) { cats[c.id] = c; });
  var rows = T('Products').filter(function (p) {
    if (status !== 'all' && p.status !== status) return false;
    if (q.category && p.category_id !== q.category) return false;
    if (stock === 'out' && p.qty !== 0) return false;
    if (stock === 'low' && !(p.qty > 0 && p.qty <= p.min_stock)) return false;
    if (stock === 'attention' && !(p.qty <= p.min_stock)) return false;
    if (stock === 'normal' && !(p.qty > p.min_stock)) return false;
    if (term) {
      var c = cats[p.category_id] || {};
      return [p.name_en, p.name_ar, p.sku, p.barcode, p.brand, c.name_en, c.name_ar, p.fragrance].some(function (v) { return like(v, term); });
    }
    return true;
  });
  var rank = function (p) { if (!term) return 0; if (p.sku.toLowerCase() === term || String(p.barcode).toLowerCase() === term) return 0; if (p.name_en.toLowerCase().indexOf(term) === 0 || p.name_ar.toLowerCase().indexOf(term) === 0) return 1; return 2; };
  var sorters = { name: function (a, b) { return a.name_en.localeCompare(b.name_en); }, sku: function (a, b) { return a.sku.localeCompare(b.sku); }, qty: function (a, b) { return a.qty - b.qty; },
    price: function (a, b) { return a.sell_price - b.sell_price; }, updated: function (a, b) { return b.updated_at.localeCompare(a.updated_at); } };
  var sorter = sorters[q.sort] || sorters.name;
  rows.sort(function (a, b) { return rank(a) - rank(b) || sorter(a, b); });
  var pg = paginate(q, 50);
  return { rows: pg.slice(rows).map(function (p) { return presentProduct(p, rq.user); }), total: rows.length };
}
function productsLookup(rq) {
  requirePerm(rq.user, 'pos.sell', 'products.manage');
  var code = String(rq.params.code).trim().toLowerCase();
  var p = T('Products').find(function (x) { return x.status === 'active' && (String(x.barcode).toLowerCase() === code || x.sku.toLowerCase() === code); });
  if (!p) throw notFound('product_not_found');
  return presentProduct(p, rq.user);
}
function productsNextSku(rq) {
  requirePerm(rq.user, 'products.manage');
  var n = parseInt(props().getProperty('counter:sku') || '0', 10) + 1; var sku;
  do { sku = 'AUR-' + String(n++).padStart(4, '0'); } while (T('Products').find(function (p) { return p.sku.toLowerCase() === sku.toLowerCase(); }));
  return { sku: sku };
}
function productsCheckUnique(rq) {
  requirePerm(rq.user, 'products.manage');
  try { assertUnique(rq.query.sku, rq.query.barcode, rq.query.exceptId); return { ok: true }; } catch (e) { return { ok: false, code: e.code, message: e.message }; }
}
function productsGet(rq) {
  requirePerm(rq.user, 'pos.sell', 'products.manage');
  var p = T('Products').get(rq.params.id); if (!p) throw notFound('product_not_found');
  var out = { product: presentProduct(p, rq.user) };
  if (can(rq.user, 'products.manage')) {
    out.movements = T('StockMovements').filter(function (m) { return m.product_id === p.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 50);
    var items = T('SaleItems').filter(function (i) { return i.product_id === p.id; });
    out.stats = { units_sold: sum(items, function (i) { return i.qty - i.returned_qty; }), revenue: sum(items, function (i) { return i.net_total - i.refunded_amount; }),
      cogs: sum(items, function (i) { return (i.qty - i.returned_qty) * i.unit_cost; }) };
    out.alerts = T('InventoryAlerts').filter(function (a) { return a.product_id === p.id; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 10);
    out.variants = p.variant_group ? T('Products').filter(function (x) { return x.variant_group === p.variant_group && x.id !== p.id; }) : [];
  }
  return out;
}
function productsCreate(rq) {
  requirePerm(rq.user, 'products.manage');
  var b = rq.body; var f = productFields(b, false);
  var initial = b.initial_qty === undefined ? 0 : int(b.initial_qty, 'initial_qty', 0, 1000000);
  var sku = f.sku || generateSku();
  assertUnique(sku, f.barcode);
  var id = newId('prd'); var t = nowIso();
  var rec = { id: id, sku: sku, barcode: f.barcode || '', name_en: f.name_en, name_ar: f.name_ar || '', category_id: f.category_id || '', brand: f.brand || '',
    cost_price: f.cost_price || 0, sell_price: f.sell_price, qty: 0, min_stock: f.min_stock === undefined ? Number(getSettings()['inventory.default_min_stock'] || 2) : f.min_stock,
    supplier_id: f.supplier_id || '', variant_group: f.variant_group || '', size: f.size || '', color: f.color || '', fragrance: f.fragrance || '', expiry_date: f.expiry_date || '',
    image_url: f.image_url || '', status: 'active', notes: f.notes || '', created_at: t, updated_at: t };
  T('Products').insert(rec);
  if (initial > 0) applyStockChange({ productId: id, delta: initial, type: 'initial', user: rq.user, reason: 'Opening stock', unitCost: rec.cost_price, refType: 'product', refId: id });
  else evaluateAlert(id);
  audit(rq.user, 'product.create', 'Products', id, { sku: sku, name: rec.name_en, qty: initial, sell_price: rec.sell_price, cost_price: rec.cost_price });
  rq.status = 201;
  return presentProduct(T('Products').get(id), rq.user);
}
function productsPatch(rq) {
  requirePerm(rq.user, 'products.manage');
  if (rq.body && 'qty' in rq.body) throw bad('qty_not_editable', 'Quantity can only change through purchases, adjustments or counts');
  var cur = T('Products').get(rq.params.id); if (!cur) throw notFound('product_not_found');
  var f = productFields(rq.body, true);
  assertUnique(f.sku, f.barcode, cur.id);
  var before = JSON.parse(JSON.stringify(cur));
  f.updated_at = nowIso();
  T('Products').update(cur.id, f);
  var changes = {}; Object.keys(f).forEach(function (k) { if (k !== 'updated_at' && before[k] !== f[k]) changes[k] = { from: before[k], to: f[k] }; });
  if (f.min_stock !== undefined || f.status !== undefined) evaluateAlert(cur.id);
  audit(rq.user, f.status === 'archived' ? 'product.archive' : f.status === 'active' && before.status === 'archived' ? 'product.restore' : 'product.update', 'Products', cur.id, changes);
  return presentProduct(T('Products').get(cur.id), rq.user);
}

// ─────────────────────────────── categories & suppliers ───────────────────────────────
function categoriesList(rq) {
  requirePerm(rq.user, 'pos.sell', 'products.manage');
  var counts = {}; T('Products').all().forEach(function (p) { if (p.status === 'active' && p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
  var rows = T('Categories').all().map(function (c) { return { id: c.id, name_en: c.name_en, name_ar: c.name_ar, active: c.active ? 1 : 0, created_at: c.created_at, updated_at: c.updated_at, product_count: counts[c.id] || 0 }; });
  rows.sort(function (a, b) { return b.active - a.active || a.name_en.localeCompare(b.name_en); });
  return { rows: rows };
}
function categoriesCreate(rq) {
  requirePerm(rq.user, 'products.manage');
  var name = req(rq.body.name_en, 'name_en', 80);
  if (T('Categories').find(function (c) { return c.name_en.toLowerCase() === name.toLowerCase(); })) throw conflict('duplicate_category');
  var id = newId('cat'); var t = nowIso();
  var rec = T('Categories').insert({ id: id, name_en: name, name_ar: str(rq.body.name_ar, 80), active: true, created_at: t, updated_at: t });
  audit(rq.user, 'category.create', 'Categories', id, rq.body);
  rq.status = 201; return rec;
}
function categoriesPatch(rq) {
  requirePerm(rq.user, 'products.manage');
  var cur = T('Categories').get(rq.params.id); if (!cur) throw notFound();
  var b = rq.body; var patch = { updated_at: nowIso() };
  if (b.name_en !== undefined) { patch.name_en = req(b.name_en, 'name_en', 80); if (T('Categories').find(function (c) { return c.id !== cur.id && c.name_en.toLowerCase() === patch.name_en.toLowerCase(); })) throw conflict('duplicate_category'); }
  if (b.name_ar !== undefined) patch.name_ar = str(b.name_ar, 80);
  if (b.active !== undefined) patch.active = !!b.active;
  T('Categories').update(cur.id, patch);
  audit(rq.user, 'category.update', 'Categories', cur.id, b);
  return T('Categories').get(cur.id);
}
function suppliersList(rq) {
  requirePerm(rq.user, 'products.manage', 'purchases.manage');
  var P = T('Purchases').all();
  var rows = T('Suppliers').all().map(function (s) {
    var mine = P.filter(function (p) { return p.supplier_id === s.id; });
    return { id: s.id, name: s.name, phone: s.phone, email: s.email, notes: s.notes, active: s.active ? 1 : 0, created_at: s.created_at, updated_at: s.updated_at, purchase_count: mine.length, purchase_total: sum(mine, function (p) { return p.total; }) };
  });
  rows.sort(function (a, b) { return b.active - a.active || a.name.localeCompare(b.name); });
  return { rows: rows };
}
function suppliersCreate(rq) {
  requirePerm(rq.user, 'products.manage', 'purchases.manage');
  var b = rq.body; var id = newId('sup'); var t = nowIso();
  var rec = T('Suppliers').insert({ id: id, name: req(b.name, 'name', 120), phone: str(b.phone, 40), email: str(b.email, 120), notes: str(b.notes, 500), active: true, created_at: t, updated_at: t });
  audit(rq.user, 'supplier.create', 'Suppliers', id, { name: rec.name });
  rq.status = 201; return rec;
}
function suppliersPatch(rq) {
  requirePerm(rq.user, 'products.manage', 'purchases.manage');
  var cur = T('Suppliers').get(rq.params.id); if (!cur) throw notFound();
  var b = rq.body; var patch = { updated_at: nowIso() };
  if (b.name !== undefined) patch.name = req(b.name, 'name', 120);
  ['phone', 'email', 'notes'].forEach(function (k) { if (b[k] !== undefined) patch[k] = str(b[k], k === 'notes' ? 500 : 120); });
  if (b.active !== undefined) patch.active = !!b.active;
  T('Suppliers').update(cur.id, patch);
  audit(rq.user, 'supplier.update', 'Suppliers', cur.id, b);
  return T('Suppliers').get(cur.id);
}

// ─────────────────────────────── inventory routes ───────────────────────────────
function alertsList(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var st = rq.query.status || 'active';
  var rows = T('InventoryAlerts').filter(function (a) { return st === 'all' ? true : st === 'active' ? (a.status === 'open' || a.status === 'reviewed') : a.status === st; });
  var order = { open: 0, reviewed: 1, resolved: 2 };
  rows.sort(function (a, b) { return order[a.status] - order[b.status] || b.type.localeCompare(a.type) || b.created_at.localeCompare(a.created_at); });
  var pg = paginate(rq.query, 50);
  return { total: rows.length, rows: pg.slice(rows).map(function (a) {
    var p = T('Products').get(a.product_id) || { qty: 0, min_stock: 0, image_url: '' };
    var o = {}; Object.keys(a).forEach(function (k) { if (k !== '_row') o[k] = a[k]; });
    o.current_qty = p.qty; o.min_stock = p.min_stock; o.image_url = p.image_url; o.name_en = p.name_en || a.name_en; o.name_ar = p.name_ar || a.name_ar;
    var s = suggestReorder(a.product_id, p.qty, p.min_stock); o.suggested = s.suggested; o.soldLast30 = s.soldLast30;
    return o;
  }) };
}
function alertsSummary(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var A = T('InventoryAlerts').all();
  var act = A.filter(function (a) { return a.status === 'open' || a.status === 'reviewed'; });
  var latest = A.filter(function (a) { return a.status === 'open'; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 10)
    .map(function (a) { return { id: a.id, type: a.type, created_at: a.created_at, qty_at_trigger: a.qty_at_trigger, sku: a.sku, name_en: a.name_en, name_ar: a.name_ar }; });
  return { open: A.filter(function (a) { return a.status === 'open'; }).length, low: act.filter(function (a) { return a.type === 'low_stock'; }).length,
    out: act.filter(function (a) { return a.type === 'out_of_stock'; }).length, latest: latest };
}
function alertsReview(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var a = T('InventoryAlerts').get(rq.params.id); if (!a) throw notFound();
  if (a.status !== 'open') throw conflict('alert_not_open');
  T('InventoryAlerts').update(a.id, { status: 'reviewed', reviewed_by: rq.user.id, reviewed_by_name: rq.user.display_name, reviewed_at: nowIso() });
  audit(rq.user, 'alert.review', 'InventoryAlerts', a.id);
  return { ok: true };
}
function movementsList(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var q = rq.query; var from = q.from ? dayStartIso(q.from) : null; var to = q.to ? dayStartIso(addDays(q.to, 1)) : null;
  var P = T('Products');
  var rows = T('StockMovements').filter(function (m) {
    if (q.productId && m.product_id !== q.productId) return false;
    if (q.type && m.type !== q.type) return false;
    if (from && m.created_at < from) return false;
    if (to && m.created_at >= to) return false;
    if (q.q) { var p = P.get(m.product_id) || {}; if (![m.sku, p.name_en, p.name_ar].some(function (v) { return like(v, q.q); })) return false; }
    return true;
  }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id); });
  var pg = paginate(q, 50);
  return { total: rows.length, rows: pg.slice(rows).map(function (m) { var p = P.get(m.product_id) || {}; var o = JSON.parse(JSON.stringify(m)); delete o._row; o.name_en = p.name_en; o.name_ar = p.name_ar; return o; }) };
}
function inventoryAdjust(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var b = rq.body; var newQty = int(b.newQty, 'newQty', 0, 1000000); var reason = str(b.reason, 300);
  if (reason.length < 3) throw bad('validation_error', 'Invalid input', [{ path: 'reason' }]);
  var p = T('Products').get(b.productId); if (!p) throw notFound('product_not_found');
  if (p.qty === newQty) throw bad('no_change', 'Quantity is unchanged');
  var r = applyStockChange({ productId: p.id, delta: newQty - p.qty, type: 'adjustment', user: rq.user, reason: reason, refType: 'manual' });
  audit(rq.user, 'stock.adjust', 'Products', p.id, { before: r.before, after: r.after, reason: reason });
  return r;
}
function countsCreate(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var b = rq.body; var items = b.items || [];
  if (!items.length || items.length > 5000) throw bad('validation_error', 'Invalid input', [{ path: 'items' }]);
  var changed = items.map(function (i) { var p = T('Products').get(i.productId); return { productId: i.productId, counted: i.counted, expected: i.expected, current: p ? p.qty : undefined }; })
    .filter(function (i) { return i.current !== undefined && i.current !== i.expected; });
  if (changed.length && !b.force) throw conflict('stock_changed_during_count', 'Stock changed while counting', changed);
  var day = localDate(); var countId = newId('cnt');
  var countNo = 'CNT-' + day.replace(/-/g, '') + '-' + String(nextCounter('count:' + day)).padStart(3, '0');
  var note = str(b.note, 300); var disc = 0;
  items.forEach(function (i) {
    var counted = int(i.counted, 'counted', 0);
    var p = T('Products').get(i.productId); if (!p) throw notFound('product_not_found');
    if (p.qty !== counted) { disc++; applyStockChange({ productId: p.id, delta: counted - p.qty, type: 'count', user: rq.user, refType: 'count', refId: countId, reason: 'Stock count ' + countNo + (note ? ': ' + note : '') }); }
  });
  audit(rq.user, 'stock.count', 'StockCounts', countId, { countNo: countNo, items: items.length, discrepancies: disc, note: note });
  return { id: countId, countNo: countNo, itemsCounted: items.length, discrepancies: disc };
}
function countsList(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var rows = T('AuditLogs').filter(function (a) { return a.action === 'stock.count'; }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 100)
    .map(function (a) { var d = {}; try { d = JSON.parse(a.details); } catch (e) {} return { id: a.entity_id, count_no: d.countNo, note: d.note || '', items_counted: d.items, discrepancies: d.discrepancies, created_at: a.created_at, user_name: a.username }; });
  return { rows: rows };
}
function inventoryOverview(rq) {
  requirePerm(rq.user, 'inventory.manage');
  var P = T('Products').filter(function (p) { return p.status === 'active'; });
  var totals = { products: P.length, units: sum(P, function (p) { return p.qty; }), cost_value: sum(P, function (p) { return p.qty * p.cost_price; }), retail_value: sum(P, function (p) { return p.qty * p.sell_price; }),
    out_count: P.filter(function (p) { return p.qty === 0; }).length, low_count: P.filter(function (p) { return p.qty > 0 && p.qty <= p.min_stock; }).length };
  var byCat = {};
  P.forEach(function (p) { var k = p.category_id || ''; var c = byCat[k] = byCat[k] || { id: k || null, name_en: (catOf(k) || {}).name_en || null, name_ar: (catOf(k) || {}).name_ar || null, products: 0, units: 0, cost_value: 0, retail_value: 0 };
    c.products++; c.units += p.qty; c.cost_value += p.qty * p.cost_price; c.retail_value += p.qty * p.sell_price; });
  var today = localDate(); var lim = addDays(today, 30); var since = addDays(today, -30);
  var items = T('SaleItems').all();
  var expiring = P.filter(function (p) { return p.expiry_date && p.expiry_date <= lim && p.qty > 0; }).sort(function (a, b) { return a.expiry_date.localeCompare(b.expiry_date); })
    .map(function (p) { return { id: p.id, sku: p.sku, name_en: p.name_en, name_ar: p.name_ar, qty: p.qty, expiry_date: p.expiry_date, expired: p.expiry_date < today }; });
  var slow = P.filter(function (p) { return p.qty > 0 && !items.some(function (i) { return i.product_id === p.id && i.local_date >= since; }); })
    .sort(function (a, b) { return b.qty * b.cost_price - a.qty * a.cost_price; }).slice(0, 20)
    .map(function (p) { var last = items.filter(function (i) { return i.product_id === p.id; }).map(function (i) { return i.local_date; }).sort().pop() || null; return { id: p.id, sku: p.sku, name_en: p.name_en, name_ar: p.name_ar, qty: p.qty, last_sold: last }; });
  return { totals: totals, byCategory: Object.keys(byCat).map(function (k) { return byCat[k]; }).sort(function (a, b) { return b.retail_value - a.retail_value; }), expiring: expiring, slowMoving: slow };
}
/** Start of a Cairo business day as a UTC ISO instant (DST-safe). */
function dayStartIso(ymd) {
  var guess = Date.parse(ymd + 'T00:00:00Z');
  var offs = [-3, -2, -4, -1, 0];
  for (var i = 0; i < offs.length; i++) { var t = guess + offs[i] * 3600000; if (localDate(new Date(t)) === ymd && localDate(new Date(t - 3600000)) !== ymd) return new Date(t).toISOString(); }
  return new Date(guess).toISOString();
}
