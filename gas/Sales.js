// ─────────────────────────────── sales ───────────────────────────────
function openShiftFor(userId) { return T('CashierShifts').find(function (s) { return s.user_id === userId && s.status === 'open'; }); }
function clean(o) { var x = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') x[k] = o[k]; }); return x; }

function loadSale(id) {
  var s = T('Sales').get(id); if (!s) return null;
  var sale = clean(s);
  var sh = s.shift_id ? T('CashierShifts').get(s.shift_id) : null; sale.shift_no = sh ? sh.shift_no : null;
  var ap = s.discount_approved_by ? T('Users').get(s.discount_approved_by) : null; sale.discount_approved_by_name = ap ? ap.display_name : null;
  return {
    sale: sale,
    items: T('SaleItems').filter(function (i) { return i.sale_id === id; }).map(clean),
    payments: (s.payments || []).map(function (p) { return { method: p.method, amount: p.amount, reference: p.reference || '' }; }),
    returns: T('Returns').filter(function (r) { return r.sale_id === id; }).sort(function (a, b) { return a.created_at.localeCompare(b.created_at); }).map(clean),
  };
}
function presentSale(out, user) {
  if (can(user, 'reports.view')) return out;
  var s = JSON.parse(JSON.stringify(out.sale)); delete s.cost_total; delete s.request_hash;
  return { sale: s, items: out.items.map(function (i) { var c = JSON.parse(JSON.stringify(i)); delete c.unit_cost; return c; }), payments: out.payments, returns: out.returns };
}

function checkout(rq) {
  requirePerm(rq.user, 'pos.sell');
  var b = rq.body || {}; var user = rq.user;
  var txn = req(b.client_txn_id, 'client_txn_id', 80);
  if (txn.length < 8) throw bad('validation_error', 'Invalid input', [{ path: 'client_txn_id' }]);
  var items = Array.isArray(b.items) ? b.items : [];
  if (!items.length || items.length > 200) throw bad('validation_error', 'Invalid input', [{ path: 'items' }]);
  var payments = (Array.isArray(b.payments) ? b.payments : []).map(function (p, i) {
    return { method: oneOf(p.method, PAYMENT_METHODS, 'payments.' + i + '.method'), amount: int(p.amount, 'payments.' + i + '.amount', 1, 100000000), reference: str(p.reference, 80) };
  });
  if (payments.length > 5) throw bad('validation_error', 'Invalid input', [{ path: 'payments' }]);
  var norm = { client_txn_id: txn, items: items.map(function (it, i) { return { product_id: req(it.product_id, 'items.' + i + '.product_id'), qty: int(it.qty, 'items.' + i + '.qty', 1, 10000), line_discount: it.line_discount ? int(it.line_discount, 'line_discount', 0) : 0 }; }),
    order_discount: b.order_discount ? int(b.order_discount, 'order_discount', 0, 100000000) : 0, payments: payments,
    customer_name: str(b.customer_name, 80), customer_phone: str(b.customer_phone, 20).replace(/[^0-9+\-\s]/g, ''), note: str(b.note, 300) };
  var hash = sha256Hex(JSON.stringify(norm));

  var prior = T('Sales').find(function (s) { return s.client_txn_id === txn; });
  if (prior) {
    if (prior.request_hash !== hash) throw conflict('idempotency_key_reused', 'This transaction ID was already used for a different sale');
    var dup = loadSale(prior.id); dup.duplicate = true; dup.alerts = []; return dup;
  }
  var settings = getSettings();
  payments.forEach(function (p) { if (settings['pos.payment_methods'].indexOf(p.method) < 0) throw bad('payment_method_disabled', 'Payment method ' + p.method + ' is disabled'); });
  var shift = openShiftFor(user.id);
  if (!shift) throw conflict('shift_required', 'Open a cashier shift before selling');

  var merged = {}; var order = [];
  norm.items.forEach(function (it) { if (merged[it.product_id]) { merged[it.product_id].qty += it.qty; merged[it.product_id].line_discount += it.line_discount; } else { merged[it.product_id] = JSON.parse(JSON.stringify(it)); order.push(it.product_id); } });
  var lines = order.map(function (pid) {
    var it = merged[pid]; var p = T('Products').get(pid);
    if (!p) throw notFound('product_not_found', 'Unknown product ' + pid);
    if (p.status !== 'active') throw conflict('product_archived', p.sku + ' is archived', { sku: p.sku });
    if (p.qty < it.qty) throw conflict('insufficient_stock', 'Insufficient stock for ' + p.sku, { productId: p.id, sku: p.sku, available: p.qty, requested: it.qty });
    var gross = p.sell_price * it.qty; // prices always come from the sheet, never from the client
    if (it.line_discount > gross) throw bad('discount_exceeds_line', 'Discount exceeds line total for ' + p.sku);
    return { p: p, qty: it.qty, gross: gross, line_discount: it.line_discount, line_total: gross - it.line_discount };
  });
  var subtotal = sum(lines, function (l) { return l.gross; });
  var lineDiscount = sum(lines, function (l) { return l.line_discount; });
  if (norm.order_discount > subtotal - lineDiscount) throw bad('discount_exceeds_total');
  var total = subtotal - lineDiscount - norm.order_discount;
  var discount = lineDiscount + norm.order_discount;
  var approvedBy = '';
  if (discount > 0) {
    var pct = subtotal ? discount * 100 / subtotal : 0;
    var allowed = can(user, 'discount.apply') && pct <= user.max_discount_pct + 1e-9;
    if (!allowed) approvedBy = verifyManagerApproval(b.manager_approval).id;
    else if (user.role === 'manager') approvedBy = user.id;
  }
  var paid = sum(payments, function (p) { return p.amount; });
  var cashTendered = sum(payments.filter(function (p) { return p.method === 'cash'; }), function (p) { return p.amount; });
  if (paid < total) throw bad('insufficient_payment', 'Payment is less than the total', { total: total, paid: paid });
  if (paid - cashTendered > total) throw bad('overpayment_non_cash', 'Card/digital payments cannot exceed the total');
  var change = paid - total;
  if (change > cashTendered) throw bad('invalid_change');

  // ── all validation passed: buffer the writes ──
  var id = newId('sal'); var t = nowIso(); var day = localDate();
  var invoiceNo = 'INV-' + day.replace(/-/g, '') + '-' + String(nextCounter('inv:' + day)).padStart(4, '0');
  var nets = allocate(norm.order_discount, lines.map(function (l) { return l.line_total; })).map(function (d, i) { return lines[i].line_total - d; });
  var pays = payments.map(function (p) { return { method: p.method, amount: p.amount, reference: p.reference }; });
  var left = change;
  pays.forEach(function (p) { if (p.method === 'cash' && left > 0) { var d = Math.min(p.amount, left); p.amount -= d; left -= d; } });
  pays = pays.filter(function (p) { return p.amount > 0; });
  T('Sales').insert({ id: id, invoice_no: invoiceNo, client_txn_id: txn, request_hash: hash, created_at: t, local_date: day, cashier_id: user.id, cashier_name: user.display_name,
    shift_id: shift.id, customer_name: norm.customer_name, customer_phone: norm.customer_phone, subtotal: subtotal, line_discount: lineDiscount, order_discount: norm.order_discount,
    total: total, cost_total: sum(lines, function (l) { return l.p.cost_price * l.qty; }), amount_received: paid, change_due: change,
    payment_summary: pays.map(function (p) { return p.method; }).join('+') || 'none', payments: pays, discount_approved_by: approvedBy, status: 'completed', note: norm.note });
  var alerts = [];
  lines.forEach(function (l, i) {
    T('SaleItems').insert({ id: newId('sli'), sale_id: id, invoice_no: invoiceNo, local_date: day, product_id: l.p.id, sku: l.p.sku, name_en: l.p.name_en, name_ar: l.p.name_ar,
      qty: l.qty, unit_price: l.p.sell_price, unit_cost: l.p.cost_price, line_discount: l.line_discount, line_total: l.line_total, net_total: nets[i], returned_qty: 0, refunded_amount: 0 });
    var r = applyStockChange({ productId: l.p.id, delta: -l.qty, type: 'sale', user: user, refType: 'sale', refId: id, unitCost: l.p.cost_price, reason: invoiceNo });
    if (r.alert) alerts.push({ id: r.alert.id, type: r.alert.type, qty: r.alert.qty, sku: l.p.sku, name_en: l.p.name_en, name_ar: l.p.name_ar });
  });
  var cashNet = sum(pays.filter(function (p) { return p.method === 'cash'; }), function (p) { return p.amount; });
  if (cashNet > 0) T('CashMovements').insert({ id: newId('csh'), shift_id: shift.id, type: 'sale', amount: cashNet, reason: invoiceNo, ref_id: id, user_id: user.id, user_name: user.display_name, created_at: t });
  audit(user, 'sale.create', 'Sales', id, { invoiceNo: invoiceNo, total: total, discount: discount, approvedBy: approvedBy, items: lines.length });
  var out = loadSale(id); out.duplicate = false; out.alerts = alerts;
  rq.status = 201;
  return out;
}

function processReturn(rq, body, kind) {
  var user = rq.user; var b = body || {};
  var txn = req(b.client_txn_id, 'client_txn_id', 80);
  var prior = T('Returns').find(function (r) { return r.client_txn_id === txn; });
  if (prior) return { duplicate: true, return: clean(prior) };
  var refundMethod = oneOf(b.refund_method, PAYMENT_METHODS, 'refund_method');
  var reason = str(b.reason, 300); if (reason.length < 3) throw bad('validation_error', 'Invalid input', [{ path: 'reason' }]);
  var items = Array.isArray(b.items) ? b.items : []; if (!items.length) throw bad('validation_error', 'Invalid input', [{ path: 'items' }]);

  var approver = null;
  var permitted = kind === 'cancellation' ? can(user, 'sales.cancel') : can(user, 'returns.process');
  if (!permitted) approver = verifyManagerApproval(b.manager_approval);
  else if (user.role === 'manager') approver = { id: user.id, display_name: user.display_name };
  var sale = T('Sales').get(b.sale_id); if (!sale) throw notFound('sale_not_found');
  if (sale.status === 'cancelled' || sale.status === 'returned') throw conflict('nothing_to_return', 'This invoice has nothing left to return');
  var maxDays = Number(getSettings()['returns.max_days'] || 0);
  if (kind === 'return' && maxDays > 0 && sale.local_date < addDays(localDate(), -maxDays) && !approver) throw forbidden('return_window_expired', 'Returns are accepted within ' + maxDays + ' days');
  var shift = openShiftFor(user.id);
  if (refundMethod === 'cash' && !shift) throw conflict('shift_required', 'Open a shift to refund cash from the drawer');

  // validate all lines before writing anything
  var seen = {};
  var plan = items.map(function (it) {
    if (seen[it.sale_item_id]) throw bad('duplicate_line'); seen[it.sale_item_id] = 1;
    var si = T('SaleItems').get(it.sale_item_id);
    if (!si || si.sale_id !== sale.id) throw notFound('sale_item_not_found');
    var qty = int(it.qty, 'qty', 1);
    var remaining = si.qty - si.returned_qty;
    if (qty > remaining) throw conflict('return_exceeds_sold', 'Only ' + remaining + ' unit(s) of ' + si.sku + ' can still be returned', { sku: si.sku, remaining: remaining });
    var refund = qty === remaining ? si.net_total - si.refunded_amount : Math.round(si.net_total * qty / si.qty);
    return { si: si, qty: qty, refund: refund, restock: it.restock !== false };
  });

  var id = newId('ret'); var t = nowIso(); var day = localDate();
  var no = (kind === 'return' ? 'RET' : 'CNL') + '-' + day.replace(/-/g, '') + '-' + String(nextCounter('ret:' + day)).padStart(3, '0');
  var refundTotal = 0, costRestored = 0;
  plan.forEach(function (x) {
    T('SaleItems').update(x.si.id, { returned_qty: x.si.returned_qty + x.qty, refunded_amount: x.si.refunded_amount + x.refund });
    refundTotal += x.refund;
    T('ReturnItems').insert({ id: newId('rti'), return_id: id, sale_item_id: x.si.id, product_id: x.si.product_id, sku: x.si.sku, qty: x.qty, refund_amount: x.refund, unit_cost: x.si.unit_cost, restocked: x.restock });
    if (x.restock) {
      costRestored += x.si.unit_cost * x.qty;
      applyStockChange({ productId: x.si.product_id, delta: x.qty, type: kind === 'return' ? 'return' : 'cancellation', user: user, refType: 'return', refId: id, unitCost: x.si.unit_cost, reason: no + ' (' + sale.invoice_no + ')' });
    }
  });
  T('Returns').insert({ id: id, return_no: no, client_txn_id: txn, kind: kind, sale_id: sale.id, invoice_no: sale.invoice_no, refund_total: refundTotal, refund_method: refundMethod,
    cost_restored: costRestored, reason: reason, user_id: user.id, user_name: user.display_name, approved_by: approver ? approver.id : '', approved_by_name: approver ? approver.display_name : '',
    shift_id: shift ? shift.id : '', created_at: t, local_date: day });
  var leftUnits = sum(T('SaleItems').filter(function (i) { return i.sale_id === sale.id; }), function (i) { return i.qty - i.returned_qty; });
  var status = leftUnits === 0 ? (kind === 'cancellation' ? 'cancelled' : 'returned') : 'partially_returned';
  T('Sales').update(sale.id, { status: status });
  if (refundMethod === 'cash' && refundTotal > 0) T('CashMovements').insert({ id: newId('csh'), shift_id: shift.id, type: 'refund', amount: -refundTotal, reason: no + ' (' + sale.invoice_no + ')', ref_id: id, user_id: user.id, user_name: user.display_name, created_at: t });
  audit(user, kind === 'return' ? 'return.create' : 'sale.cancel', 'Returns', id, { no: no, invoice: sale.invoice_no, refundTotal: refundTotal, reason: reason, approvedBy: approver ? approver.id : '' });
  rq.status = 201;
  return { duplicate: false, return: clean(T('Returns').get(id)), sale_status: status };
}

function salesList(rq) {
  requirePerm(rq.user, 'sales.view_own', 'sales.view_all');
  var q = rq.query; var all = can(rq.user, 'sales.view_all');
  var rows = T('Sales').filter(function (s) {
    if (!all && s.cashier_id !== rq.user.id) return false;
    if (all && q.cashier && s.cashier_id !== q.cashier) return false;
    if (q.from && s.local_date < q.from) return false;
    if (q.to && s.local_date > q.to) return false;
    if (q.status && s.status !== q.status) return false;
    if (q.shift && s.shift_id !== q.shift) return false;
    if (q.method && !(s.payments || []).some(function (p) { return p.method === q.method; })) return false;
    if (q.q && ![s.invoice_no, s.customer_phone, s.customer_name].some(function (v) { return like(v, q.q); })) return false;
    return true;
  });
  if (q.product) { var ids = {}; T('SaleItems').all().forEach(function (i) { if (i.product_id === q.product) ids[i.sale_id] = 1; }); rows = rows.filter(function (s) { return ids[s.id]; }); }
  rows.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
  var pg = paginate(q, 50); var page = pg.slice(rows);
  var units = {}; T('SaleItems').all().forEach(function (i) { units[i.sale_id] = (units[i.sale_id] || 0) + i.qty; });
  var refunded = {}; T('Returns').all().forEach(function (r) { refunded[r.sale_id] = (refunded[r.sale_id] || 0) + r.refund_total; });
  var showCost = can(rq.user, 'reports.view');
  return { total: rows.length, amount: sum(rows, function (s) { return s.total; }), rows: page.map(function (s) {
    var o = clean(s); if (!showCost) { delete o.cost_total; delete o.request_hash; } o.units = units[s.id] || 0; o.refunded = refunded[s.id] || 0; return o;
  }) };
}
function salesByInvoice(rq) {
  requirePerm(rq.user, 'pos.sell', 'sales.view_all');
  var no = String(rq.params.no).trim().toLowerCase();
  var s = T('Sales').find(function (x) { return x.invoice_no.toLowerCase() === no; }); if (!s) throw notFound('sale_not_found');
  return presentSale(loadSale(s.id), rq.user);
}
function salesGet(rq) {
  requirePerm(rq.user, 'sales.view_own', 'sales.view_all');
  var out = loadSale(rq.params.id); if (!out) throw notFound('sale_not_found');
  if (!can(rq.user, 'sales.view_all') && out.sale.cashier_id !== rq.user.id) throw forbidden();
  return presentSale(out, rq.user);
}
function salesReprint(rq) {
  requirePerm(rq.user, 'receipts.print');
  var out = loadSale(rq.params.id); if (!out) throw notFound('sale_not_found');
  if (!can(rq.user, 'sales.view_all') && out.sale.cashier_id !== rq.user.id) throw forbidden();
  audit(rq.user, 'receipt.reprint', 'Sales', out.sale.id, { invoice: out.sale.invoice_no });
  return presentSale(out, rq.user);
}
function salesCancel(rq) {
  requirePerm(rq.user, 'pos.sell');
  var sale = T('Sales').get(rq.params.id); if (!sale) throw notFound('sale_not_found');
  var items = T('SaleItems').filter(function (i) { return i.sale_id === sale.id && i.qty > i.returned_qty; });
  if (!items.length) throw conflict('nothing_to_return');
  var body = JSON.parse(JSON.stringify(rq.body || {})); body.sale_id = sale.id;
  body.items = items.map(function (i) { return { sale_item_id: i.id, qty: i.qty - i.returned_qty, restock: true }; });
  return processReturn(rq, body, 'cancellation');
}
function returnsCreate(rq) { requirePerm(rq.user, 'pos.sell'); return processReturn(rq, rq.body, 'return'); }
function returnsList(rq) {
  requirePerm(rq.user, 'returns.process', 'reports.view');
  var q = rq.query; var all = can(rq.user, 'reports.view');
  var rows = T('Returns').filter(function (r) {
    if (!all && r.user_id !== rq.user.id) return false;
    if (q.from && r.local_date < q.from) return false; if (q.to && r.local_date > q.to) return false;
    if (q.kind && r.kind !== q.kind) return false;
    if (q.q && ![r.return_no, r.invoice_no].some(function (v) { return like(v, q.q); })) return false;
    return true;
  }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
  var units = {}; T('ReturnItems').all().forEach(function (i) { units[i.return_id] = (units[i.return_id] || 0) + i.qty; });
  var pg = paginate(q, 50);
  return { total: rows.length, amount: sum(rows, function (r) { return r.refund_total; }), rows: pg.slice(rows).map(function (r) { var o = clean(r); o.units = units[r.id] || 0; return o; }) };
}
function returnsGet(rq) {
  requirePerm(rq.user, 'returns.process', 'reports.view');
  var r = T('Returns').get(rq.params.id); if (!r) throw notFound();
  return { return: clean(r), items: T('ReturnItems').filter(function (i) { return i.return_id === r.id; }).map(function (i) { var si = T('SaleItems').get(i.sale_item_id) || {}; var o = clean(i); o.name_en = si.name_en; o.name_ar = si.name_ar; return o; }) };
}

// ─────────────────────────────── purchases ───────────────────────────────
function purchasesList(rq) {
  requirePerm(rq.user, 'purchases.manage');
  var q = rq.query;
  var rows = T('Purchases').filter(function (p) {
    if (q.supplier && p.supplier_id !== q.supplier) return false;
    if (q.from && p.purchase_date < q.from) return false; if (q.to && p.purchase_date > q.to) return false;
    if (q.q && ![p.purchase_no, p.reference].some(function (v) { return like(v, q.q); })) return false;
    return true;
  }).sort(function (a, b) { return b.purchase_date.localeCompare(a.purchase_date) || b.created_at.localeCompare(a.created_at); });
  var items = T('PurchaseItems').all();
  var pg = paginate(q, 50);
  return { total: rows.length, amount: sum(rows, function (p) { return p.total; }), rows: pg.slice(rows).map(function (p) {
    var mine = items.filter(function (i) { return i.purchase_id === p.id; }); var s = T('Suppliers').get(p.supplier_id);
    var o = clean(p); o.supplier_name = s ? s.name : null; o.item_count = mine.length; o.units = sum(mine, function (i) { return i.qty; }); return o;
  }) };
}
function purchasesGet(rq) {
  requirePerm(rq.user, 'purchases.manage');
  var p = T('Purchases').get(rq.params.id); if (!p) throw notFound();
  var s = T('Suppliers').get(p.supplier_id); var o = clean(p); o.supplier_name = s ? s.name : null;
  return { purchase: o, items: T('PurchaseItems').filter(function (i) { return i.purchase_id === p.id; }).map(function (i) { var pr = T('Products').get(i.product_id) || {}; var x = clean(i); x.name_en = pr.name_en; x.name_ar = pr.name_ar; return x; }) };
}
function purchasesCreate(rq) {
  requirePerm(rq.user, 'purchases.manage');
  var b = rq.body || {}; var txn = req(b.client_txn_id, 'client_txn_id', 80);
  var ex = T('Purchases').find(function (p) { return p.client_txn_id === txn; });
  if (ex) return { id: ex.id, duplicate: true };
  if (b.supplier_id && !T('Suppliers').get(b.supplier_id)) throw bad('unknown_supplier');
  var items = (b.items || []).map(function (it, i) {
    var p = T('Products').get(it.product_id); if (!p) throw notFound('product_not_found');
    return { p: p, qty: int(it.qty, 'items.' + i + '.qty', 1, 100000), unit_cost: int(it.unit_cost, 'items.' + i + '.unit_cost', 0, 100000000) };
  });
  if (!items.length) throw bad('validation_error', 'Invalid input', [{ path: 'items' }]);
  var date = b.purchase_date && isYmd(b.purchase_date) ? b.purchase_date : localDate();
  var id = newId('pur'); var no = 'PO-' + date.replace(/-/g, '') + '-' + String(nextCounter('po:' + date)).padStart(3, '0');
  var total = sum(items, function (i) { return i.qty * i.unit_cost; });
  var reference = str(b.reference, 80);
  T('Purchases').insert({ id: id, purchase_no: no, client_txn_id: txn, purchase_date: date, supplier_id: b.supplier_id || '', reference: reference, total: total, notes: str(b.notes, 500),
    created_by: rq.user.id, created_by_name: rq.user.display_name, created_at: nowIso() });
  items.forEach(function (it) {
    T('PurchaseItems').insert({ id: newId('pui'), purchase_id: id, product_id: it.p.id, sku: it.p.sku, qty: it.qty, unit_cost: it.unit_cost, line_total: it.qty * it.unit_cost });
    if (b.update_cost !== false) {
      var avg = it.p.qty > 0 ? Math.round((it.p.qty * it.p.cost_price + it.qty * it.unit_cost) / (it.p.qty + it.qty)) : it.unit_cost; // weighted moving average
      T('Products').update(it.p.id, { cost_price: avg, supplier_id: it.p.supplier_id || b.supplier_id || '' });
    }
    applyStockChange({ productId: it.p.id, delta: it.qty, type: 'purchase', user: rq.user, refType: 'purchase', refId: id, unitCost: it.unit_cost, reason: 'Received ' + no + (reference ? ' / ' + reference : '') });
  });
  audit(rq.user, 'purchase.create', 'Purchases', id, { no: no, total: total, items: items.length });
  rq.status = 201;
  return { id: id, purchase_no: no, total: total };
}
