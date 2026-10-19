// ─────────────────────────────── admin: audit, integrity, backups, exports, status ───────────────────────────────
function auditList(rq) {
  requirePerm(rq.user, 'audit.view');
  var q = rq.query; var from = q.from ? dayStartIso(q.from) : null; var to = q.to ? dayStartIso(addDays(q.to, 1)) : null;
  var rows = T('AuditLogs').filter(function (a) {
    if (q.action && a.action.indexOf(q.action) !== 0) return false;
    if (q.user && a.user_id !== q.user) return false;
    if (from && a.created_at < from) return false; if (to && a.created_at >= to) return false;
    if (q.q && ![a.entity_id, a.details, a.username].some(function (v) { return like(v, q.q); })) return false;
    return true;
  }).sort(function (a, b) { return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id); });
  var pg = paginate(q, 100);
  return { total: rows.length, rows: pg.slice(rows).map(clean) };
}

function integrityReport() {
  var P = T('Products').all(), M = T('StockMovements').all(), S = T('Sales').all(), I = T('SaleItems').all(), R = T('Returns').all(), RI = T('ReturnItems').all(), A = T('InventoryAlerts').all();
  var ledger = {}; M.forEach(function (m) { ledger[m.product_id] = (ledger[m.product_id] || 0) + m.qty_change; });
  var bySale = {}; I.forEach(function (i) { (bySale[i.sale_id] = bySale[i.sale_id] || []).push(i); });
  var deducted = {}; M.forEach(function (m) { if (m.ref_type === 'sale') { var k = m.ref_id + '|' + m.product_id; deducted[k] = (deducted[k] || 0) - m.qty_change; } });
  var retQty = {}; RI.forEach(function (r) { retQty[r.sale_item_id] = (retQty[r.sale_item_id] || 0) + r.qty; });
  var retTot = {}; RI.forEach(function (r) { retTot[r.return_id] = (retTot[r.return_id] || 0) + r.refund_amount; });
  var checks = [
    { key: 'stock_vs_movements', rows: P.filter(function (p) { return p.qty !== (ledger[p.id] || 0); }).map(function (p) { return { id: p.id, sku: p.sku, qty: p.qty, ledger: ledger[p.id] || 0 }; }) },
    { key: 'sale_totals', rows: S.filter(function (s) { return s.total !== sum(bySale[s.id] || [], function (i) { return i.line_total; }) - s.order_discount; }).map(function (s) { return { id: s.id, invoice_no: s.invoice_no }; }) },
    { key: 'sale_net_lines', rows: S.filter(function (s) { return s.total !== sum(bySale[s.id] || [], function (i) { return i.net_total; }); }).map(function (s) { return { id: s.id, invoice_no: s.invoice_no }; }) },
    { key: 'sale_payments', rows: S.filter(function (s) { return s.total !== sum(s.payments || [], function (p) { return p.amount; }); }).map(function (s) { return { id: s.id, invoice_no: s.invoice_no }; }) },
    { key: 'sales_without_items', rows: S.filter(function (s) { return !(bySale[s.id] || []).length; }).map(function (s) { return { id: s.id, invoice_no: s.invoice_no }; }) },
    { key: 'sale_stock_deduction', rows: I.filter(function (i) { return (deducted[i.sale_id + '|' + i.product_id] || 0) !== sum(bySale[i.sale_id].filter(function (x) { return x.product_id === i.product_id; }), function (x) { return x.qty; }); }).map(function (i) { return { id: i.id, sku: i.sku, invoice_no: i.invoice_no }; }) },
    { key: 'returned_qty', rows: I.filter(function (i) { return i.returned_qty !== (retQty[i.id] || 0); }).map(function (i) { return { id: i.id, sku: i.sku }; }) },
    { key: 'return_totals', rows: R.filter(function (r) { return r.refund_total !== (retTot[r.id] || 0); }).map(function (r) { return { id: r.id, return_no: r.return_no }; }) },
    { key: 'alerts_vs_stock', rows: P.filter(function (p) {
      if (p.status !== 'active') return false;
      var a = A.find(function (x) { return x.product_id === p.id && (x.status === 'open' || x.status === 'reviewed'); });
      var lvl = stockLevel(p.qty, p.min_stock);
      return (lvl !== 'normal' && !a) || (lvl === 'normal' && a) || (lvl === 'out' && a && a.type !== 'out_of_stock') || (lvl === 'low' && a && a.type !== 'low_stock');
    }).map(function (p) { return { id: p.id, sku: p.sku }; }) },
  ];
  return { generated_at: nowIso(), ok: checks.every(function (c) { return !c.rows.length; }), checks: checks.map(function (c) { return { key: c.key, count: c.rows.length, rows: c.rows.slice(0, 50) }; }) };
}

// Backups: full copies of the spreadsheet in a Drive folder (daily trigger + manual).
var BACKUP_FOLDER = 'AURIX Backups';
function backupFolder() {
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
}
function createBackup(label) {
  var ss = getSS();
  var name = 'AURIX backup ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH-mm') + ' (' + (label || 'manual') + ')';
  var file = DriveApp.getFileById(ss.getId()).makeCopy(name, backupFolder());
  // retention: keep the newest 30
  var files = []; var it = backupFolder().getFiles(); while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(30).forEach(function (f) { f.setTrashed(true); });
  return { name: name, url: file.getUrl() };
}
function dailyBackup() { createBackup('auto'); }
function backupsList(rq) {
  requirePerm(rq.user, 'settings.manage');
  var rows = []; var it = backupFolder().getFiles();
  while (it.hasNext()) { var f = it.next(); rows.push({ name: f.getName(), url: f.getUrl(), created_at: f.getDateCreated().toISOString(), size: f.getSize() }); }
  rows.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
  return { rows: rows };
}
function backupsCreate(rq) { requirePerm(rq.user, 'settings.manage'); var b = createBackup('manual'); audit(rq.user, 'backup.create', 'Settings', '', b); return b; }

function sheetStatus(rq) {
  requirePerm(rq.user, 'sync.manage');
  var ss = getSS();
  var tabs = TAB_ORDER.map(function (n) { var sh = ss.getSheetByName(n); return { tab: n, exists: !!sh, rows: sh ? Math.max(0, sh.getLastRow() - 1) : 0 }; });
  return { mode: 'apps_script', spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl(), name: ss.getName(), version: VERSION, tabs: tabs, ok: tabs.every(function (t) { return t.exists; }) };
}
function sheetInit(rq) { requirePerm(rq.user, 'sync.manage'); var r = ensureTabs(); audit(rq.user, 'sync.initialize', 'Settings', '', r); return r; }

// CSV exports (filters + permissions respected)
function csvCell(v) {
  var s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows) {
  var h = rows[0] ? Object.keys(rows[0]) : [];
  return '﻿' + [h.join(',')].concat(rows.map(function (r) { return h.map(function (k) { return csvCell(r[k]); }).join(','); })).join('\r\n');
}
function exportCsv(rq) {
  requirePerm(rq.user, 'export.data');
  var q = rq.query; var e = rq.params.entity; var rows = []; var M = function (v) { return egp(v || 0); };
  var dr = function (d) { return (!q.from || d >= q.from) && (!q.to || d <= q.to); };
  switch (e) {
    case 'products': {
      var st = q.status || 'active';
      rows = T('Products').filter(function (p) {
        if (st !== 'all' && p.status !== st) return false; if (q.category && p.category_id !== q.category) return false;
        if (q.stock === 'low' && !(p.qty > 0 && p.qty <= p.min_stock)) return false; if (q.stock === 'out' && p.qty !== 0) return false; if (q.stock === 'attention' && p.qty > p.min_stock) return false;
        if (q.q && ![p.name_en, p.name_ar, p.sku, p.barcode].some(function (v) { return like(v, q.q); })) return false; return true;
      }).map(function (p) { var c = catOf(p.category_id); var o = { sku: p.sku, barcode: p.barcode, name_en: p.name_en, name_ar: p.name_ar, category: c ? c.name_en : '', brand: p.brand };
        if (can(rq.user, 'products.view_cost')) o.cost_price = M(p.cost_price);
        o.sell_price = M(p.sell_price); o.qty = p.qty; o.min_stock = p.min_stock; o.size = p.size; o.color = p.color; o.fragrance = p.fragrance; o.expiry_date = p.expiry_date; o.status = p.status; o.updated_at = p.updated_at; return o; });
      break;
    }
    case 'sales':
      rows = T('Sales').filter(function (s) { return dr(s.local_date) && (!q.cashier || s.cashier_id === q.cashier) && (!q.status || s.status === q.status) && (!q.method || (s.payments || []).some(function (p) { return p.method === q.method; })) && (!q.q || like(s.invoice_no, q.q) || like(s.customer_phone, q.q)); })
        .map(function (s) { return { invoice_no: s.invoice_no, created_at: s.created_at, local_date: s.local_date, cashier: s.cashier_name, customer_name: s.customer_name, customer_phone: s.customer_phone,
          subtotal: M(s.subtotal), discount: M(s.line_discount + s.order_discount), total: M(s.total), cost_total: M(s.cost_total), payment_summary: s.payment_summary, amount_received: M(s.amount_received), change_due: M(s.change_due), status: s.status }; });
      break;
    case 'sale-items':
      rows = T('SaleItems').filter(function (i) { return dr(i.local_date) && (!q.product || i.product_id === q.product); })
        .map(function (i) { return { invoice_no: i.invoice_no, local_date: i.local_date, sku: i.sku, name_en: i.name_en, qty: i.qty, unit_price: M(i.unit_price), unit_cost: M(i.unit_cost), line_discount: M(i.line_discount), net_total: M(i.net_total), returned_qty: i.returned_qty, refunded_amount: M(i.refunded_amount) }; });
      break;
    case 'movements':
      rows = T('StockMovements').filter(function (m) { var d = localDate(m.created_at); return dr(d) && (!q.type || m.type === q.type) && (!q.product || m.product_id === q.product) && (!q.q || like(m.sku, q.q)); })
        .map(function (m) { return { created_at: m.created_at, sku: m.sku, type: m.type, qty_change: m.qty_change, qty_before: m.qty_before, qty_after: m.qty_after, ref_type: m.ref_type, ref_id: m.ref_id, reason: m.reason, user: m.user_name }; });
      break;
    case 'purchases':
      rows = T('PurchaseItems').all().map(function (i) { var p = T('Purchases').get(i.purchase_id) || {}; var s = T('Suppliers').get(p.supplier_id); return { purchase_no: p.purchase_no, purchase_date: p.purchase_date, supplier: s ? s.name : '', supplier_id: p.supplier_id, reference: p.reference, sku: i.sku, qty: i.qty, unit_cost: M(i.unit_cost), line_total: M(i.line_total) }; })
        .filter(function (r) { return dr(r.purchase_date) && (!q.supplier || r.supplier_id === q.supplier); });
      break;
    case 'returns':
      rows = T('Returns').filter(function (r) { return dr(r.local_date); }).map(function (r) { return { return_no: r.return_no, kind: r.kind, created_at: r.created_at, invoice_no: r.invoice_no, refund_total: M(r.refund_total), refund_method: r.refund_method, reason: r.reason, user: r.user_name }; });
      break;
    case 'expenses':
      rows = T('Expenses').filter(function (x) { return dr(x.expense_date) && (!q.category || x.category === q.category) && (!q.method || x.payment_method === q.method) && (!q.status || x.status === q.status); })
        .map(function (x) { return { expense_date: x.expense_date, category: x.category, description: x.description, amount: M(x.amount), payment_method: x.payment_method, reference: x.reference, status: x.status, user: x.user_name }; });
      break;
    case 'shifts':
      rows = T('CashierShifts').filter(function (s) { return !q.cashier || s.user_id === q.cashier; }).map(function (s) { return { shift_no: s.shift_no, cashier: s.user_name, opened_at: s.opened_at, closed_at: s.closed_at, opening_cash: M(s.opening_cash),
        expected_cash: s.expected_cash === null ? '' : M(s.expected_cash), counted_cash: s.counted_cash === null ? '' : M(s.counted_cash), difference: s.difference === null ? '' : M(s.difference), status: s.status }; });
      break;
    case 'alerts':
      rows = T('InventoryAlerts').all().map(function (a) { var p = T('Products').get(a.product_id) || {}; return { created_at: a.created_at, sku: a.sku, name_en: a.name_en, type: a.type, status: a.status, qty_at_trigger: a.qty_at_trigger, current_qty: p.qty, threshold: a.threshold, reviewed_at: a.reviewed_at, resolved_at: a.resolved_at }; });
      break;
    case 'audit':
      rows = T('AuditLogs').filter(function (a) { return dr(localDate(a.created_at)); }).map(function (a) { return { created_at: a.created_at, username: a.username, action: a.action, entity: a.entity, entity_id: a.entity_id, details: a.details }; });
      break;
    default: throw notFound('unknown_export');
  }
  rows.forEach(function (r) { delete r.supplier_id; });
  audit(rq.user, 'export.csv', e, '', { filters: q, rows: rows.length });
  return { filename: 'aurix-' + e + '-' + localDate() + '.csv', csv: toCsv(rows) };
}
