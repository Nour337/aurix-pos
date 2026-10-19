/**
 * AURIX POS — Google Apps Script backend (Google Sheets is the database).
 *
 * Deploy: Extensions ▸ Apps Script in the "AURIX Store Data" spreadsheet, paste this file,
 * run `setup` once, then Deploy ▸ New deployment ▸ Web app (Execute as: Me, Access: Anyone).
 *
 * Data integrity model (Sheets has no transactions):
 *  • Every state-changing request runs under LockService (one writer at a time → no overselling).
 *  • Handlers validate EVERYTHING first and only buffer writes; the buffer is flushed at the end.
 *    A validation error therefore writes nothing.
 *  • Sales / returns / purchases carry a client transaction ID: a retry returns the original result
 *    and never deducts stock twice.
 *  • Records are never deleted; returns, cancellations and voids are separate rows.
 *  • Passwords (salted, iterated HMAC-SHA256) and the session-signing secret live in Script
 *    Properties — never in the spreadsheet.
 */
var TZ = 'Africa/Cairo';
var VERSION = '2.0.0';
/** Spreadsheet used as the database. Bound scripts use their own sheet; a standalone script uses this ID. */
var SPREADSHEET_ID = '1u44FptXbW_lAuSfNtrw-AmDQMoPVj527ICSqoXkU3rE';
function getSS() {
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { active = null; }
  return active || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || SPREADSHEET_ID);
}

// ─────────────────────────────── schema ───────────────────────────────
// [Header in sheet, field name, type]  types: s=string, n=number, m=money (EGP in sheet, piasters in code),
// mn=nullable money, b=boolean, j=JSON
var SCHEMA = {
  Settings: [['Key', 'key', 's'], ['Value', 'value', 's'], ['UpdatedAt', 'updated_at', 's']],
  Users: [['UserID', 'id', 's'], ['Username', 'username', 's'], ['DisplayName', 'display_name', 's'], ['Role', 'role', 's'], ['Permissions', 'permissions', 'j'],
    ['MaxDiscountPct', 'max_discount_pct', 'n'], ['Active', 'active', 'b'], ['MustChangePassword', 'must_change_password', 'b'], ['CreatedAt', 'created_at', 's'],
    ['UpdatedAt', 'updated_at', 's'], ['LastLoginAt', 'last_login_at', 's']],
  Products: [['ProductID', 'id', 's'], ['SKU', 'sku', 's'], ['Barcode', 'barcode', 's'], ['NameEN', 'name_en', 's'], ['NameAR', 'name_ar', 's'], ['CategoryID', 'category_id', 's'],
    ['Brand', 'brand', 's'], ['CostPrice', 'cost_price', 'm'], ['SellPrice', 'sell_price', 'm'], ['Quantity', 'qty', 'n'], ['MinStock', 'min_stock', 'n'], ['StockStatus', 'stock_status', 's'],
    ['SupplierID', 'supplier_id', 's'], ['VariantGroup', 'variant_group', 's'], ['Size', 'size', 's'], ['Color', 'color', 's'], ['Fragrance', 'fragrance', 's'],
    ['ExpiryDate', 'expiry_date', 's'], ['ImageURL', 'image_url', 's'], ['Status', 'status', 's'], ['Notes', 'notes', 's'], ['CreatedAt', 'created_at', 's'], ['UpdatedAt', 'updated_at', 's']],
  Categories: [['CategoryID', 'id', 's'], ['NameEN', 'name_en', 's'], ['NameAR', 'name_ar', 's'], ['Active', 'active', 'b'], ['CreatedAt', 'created_at', 's'], ['UpdatedAt', 'updated_at', 's']],
  Suppliers: [['SupplierID', 'id', 's'], ['Name', 'name', 's'], ['Phone', 'phone', 's'], ['Email', 'email', 's'], ['Notes', 'notes', 's'], ['Active', 'active', 'b'],
    ['CreatedAt', 'created_at', 's'], ['UpdatedAt', 'updated_at', 's']],
  Sales: [['SaleID', 'id', 's'], ['InvoiceNumber', 'invoice_no', 's'], ['ClientTxnID', 'client_txn_id', 's'], ['RequestHash', 'request_hash', 's'], ['CreatedAt', 'created_at', 's'],
    ['LocalDate', 'local_date', 's'], ['CashierID', 'cashier_id', 's'], ['Cashier', 'cashier_name', 's'], ['ShiftID', 'shift_id', 's'], ['CustomerName', 'customer_name', 's'],
    ['CustomerPhone', 'customer_phone', 's'], ['Subtotal', 'subtotal', 'm'], ['LineDiscount', 'line_discount', 'm'], ['OrderDiscount', 'order_discount', 'm'], ['Total', 'total', 'm'],
    ['CostTotal', 'cost_total', 'm'], ['AmountReceived', 'amount_received', 'm'], ['ChangeDue', 'change_due', 'm'], ['PaymentMethod', 'payment_summary', 's'],
    ['Payments', 'payments', 'j'], ['DiscountApprovedBy', 'discount_approved_by', 's'], ['Status', 'status', 's'], ['Note', 'note', 's']],
  SaleItems: [['SaleItemID', 'id', 's'], ['SaleID', 'sale_id', 's'], ['InvoiceNumber', 'invoice_no', 's'], ['LocalDate', 'local_date', 's'], ['ProductID', 'product_id', 's'],
    ['SKU', 'sku', 's'], ['NameEN', 'name_en', 's'], ['NameAR', 'name_ar', 's'], ['Qty', 'qty', 'n'], ['UnitPrice', 'unit_price', 'm'], ['UnitCost', 'unit_cost', 'm'],
    ['LineDiscount', 'line_discount', 'm'], ['LineTotal', 'line_total', 'm'], ['NetTotal', 'net_total', 'm'], ['ReturnedQty', 'returned_qty', 'n'], ['RefundedAmount', 'refunded_amount', 'm']],
  Purchases: [['PurchaseID', 'id', 's'], ['PurchaseNumber', 'purchase_no', 's'], ['ClientTxnID', 'client_txn_id', 's'], ['Date', 'purchase_date', 's'], ['SupplierID', 'supplier_id', 's'],
    ['Reference', 'reference', 's'], ['Total', 'total', 'm'], ['Notes', 'notes', 's'], ['CreatedBy', 'created_by', 's'], ['CreatedByName', 'created_by_name', 's'], ['CreatedAt', 'created_at', 's']],
  PurchaseItems: [['PurchaseItemID', 'id', 's'], ['PurchaseID', 'purchase_id', 's'], ['ProductID', 'product_id', 's'], ['SKU', 'sku', 's'], ['Qty', 'qty', 'n'],
    ['UnitCost', 'unit_cost', 'm'], ['LineTotal', 'line_total', 'm']],
  StockMovements: [['MovementID', 'id', 's'], ['CreatedAt', 'created_at', 's'], ['ProductID', 'product_id', 's'], ['SKU', 'sku', 's'], ['Type', 'type', 's'], ['QtyChange', 'qty_change', 'n'],
    ['QtyBefore', 'qty_before', 'n'], ['QtyAfter', 'qty_after', 'n'], ['UnitCost', 'unit_cost', 'mn'], ['RefType', 'ref_type', 's'], ['RefID', 'ref_id', 's'], ['Reason', 'reason', 's'],
    ['UserID', 'user_id', 's'], ['User', 'user_name', 's']],
  Returns: [['ReturnID', 'id', 's'], ['ReturnNumber', 'return_no', 's'], ['ClientTxnID', 'client_txn_id', 's'], ['Kind', 'kind', 's'], ['SaleID', 'sale_id', 's'],
    ['InvoiceNumber', 'invoice_no', 's'], ['RefundTotal', 'refund_total', 'm'], ['RefundMethod', 'refund_method', 's'], ['CostRestored', 'cost_restored', 'm'], ['Reason', 'reason', 's'],
    ['UserID', 'user_id', 's'], ['User', 'user_name', 's'], ['ApprovedBy', 'approved_by', 's'], ['ApprovedByName', 'approved_by_name', 's'], ['ShiftID', 'shift_id', 's'],
    ['CreatedAt', 'created_at', 's'], ['LocalDate', 'local_date', 's']],
  ReturnItems: [['ReturnItemID', 'id', 's'], ['ReturnID', 'return_id', 's'], ['SaleItemID', 'sale_item_id', 's'], ['ProductID', 'product_id', 's'], ['SKU', 'sku', 's'],
    ['Qty', 'qty', 'n'], ['RefundAmount', 'refund_amount', 'm'], ['UnitCost', 'unit_cost', 'm'], ['Restocked', 'restocked', 'b']],
  Expenses: [['ExpenseID', 'id', 's'], ['Date', 'expense_date', 's'], ['Category', 'category', 's'], ['Description', 'description', 's'], ['Amount', 'amount', 'm'],
    ['PaymentMethod', 'payment_method', 's'], ['Reference', 'reference', 's'], ['UserID', 'user_id', 's'], ['User', 'user_name', 's'], ['ShiftID', 'shift_id', 's'],
    ['Status', 'status', 's'], ['VoidReason', 'void_reason', 's'], ['CreatedAt', 'created_at', 's']],
  CashierShifts: [['ShiftID', 'id', 's'], ['ShiftNumber', 'shift_no', 's'], ['UserID', 'user_id', 's'], ['Cashier', 'user_name', 's'], ['OpenedAt', 'opened_at', 's'],
    ['OpeningCash', 'opening_cash', 'm'], ['ClosedAt', 'closed_at', 's'], ['ExpectedCash', 'expected_cash', 'mn'], ['CountedCash', 'counted_cash', 'mn'],
    ['Difference', 'difference', 'mn'], ['Status', 'status', 's'], ['Notes', 'notes', 's'], ['ClosedBy', 'closed_by', 's']],
  CashMovements: [['CashMovementID', 'id', 's'], ['ShiftID', 'shift_id', 's'], ['Type', 'type', 's'], ['Amount', 'amount', 'm'], ['Reason', 'reason', 's'], ['RefID', 'ref_id', 's'],
    ['UserID', 'user_id', 's'], ['User', 'user_name', 's'], ['CreatedAt', 'created_at', 's']],
  InventoryAlerts: [['AlertID', 'id', 's'], ['ProductID', 'product_id', 's'], ['SKU', 'sku', 's'], ['ProductName', 'name_en', 's'], ['ProductNameAR', 'name_ar', 's'], ['Type', 'type', 's'],
    ['Status', 'status', 's'], ['QtyAtTrigger', 'qty_at_trigger', 'n'], ['Threshold', 'threshold', 'n'], ['CreatedAt', 'created_at', 's'], ['ReviewedBy', 'reviewed_by', 's'],
    ['ReviewedByName', 'reviewed_by_name', 's'], ['ReviewedAt', 'reviewed_at', 's'], ['ResolvedAt', 'resolved_at', 's'], ['Resolution', 'resolution', 's']],
  AuditLogs: [['AuditID', 'id', 's'], ['CreatedAt', 'created_at', 's'], ['UserID', 'user_id', 's'], ['Username', 'username', 's'], ['Action', 'action', 's'],
    ['Entity', 'entity', 's'], ['EntityID', 'entity_id', 's'], ['Details', 'details', 's']],
};
var TAB_ORDER = ['Settings', 'Users', 'Products', 'Categories', 'Suppliers', 'Sales', 'SaleItems', 'Purchases', 'PurchaseItems', 'StockMovements',
  'Returns', 'ReturnItems', 'Expenses', 'CashierShifts', 'CashMovements', 'InventoryAlerts', 'AuditLogs'];

// ─────────────────────────────── errors & utils ───────────────────────────────
function AppError(status, code, message, details) { this.status = status; this.code = code; this.message = message || code; this.details = details; }
function bad(code, msg, d) { return new AppError(400, code, msg, d); }
function forbidden(code, msg) { return new AppError(403, code || 'forbidden', msg); }
function notFound(code, msg) { return new AppError(404, code || 'not_found', msg); }
function conflict(code, msg, d) { return new AppError(409, code, msg, d); }

function nowIso() { return new Date().toISOString(); }
function localDate(d) { return Utilities.formatDate(d ? new Date(d) : new Date(), TZ, 'yyyy-MM-dd'); }
function addDays(ymd, n) { var p = ymd.split('-').map(Number); var t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return t.toISOString().slice(0, 10); }
function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function newId(prefix) { return prefix + '_' + Date.now().toString(36) + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function egp(p) { return Math.round(p) / 100; }
function allocate(amount, weights) {
  var total = weights.reduce(function (a, b) { return a + b; }, 0);
  if (!amount || !total) return weights.map(function () { return 0; });
  var raw = weights.map(function (w) { return amount * w / total; });
  var out = raw.map(Math.floor);
  var rest = amount - out.reduce(function (a, b) { return a + b; }, 0);
  var order = raw.map(function (r, i) { return [r - Math.floor(r), i]; }).sort(function (a, b) { return b[0] - a[0]; });
  for (var k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}
function stockLevel(qty, min) { return qty <= 0 ? 'out' : qty <= min ? 'low' : 'normal'; }
function str(v, max) { if (v === undefined || v === null) return ''; return String(v).trim().slice(0, max || 500); }
function int(v, name, min, max) {
  var n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n) throw bad('validation_error', 'Invalid input', [{ path: name, message: 'integer expected' }]);
  if (min !== undefined && n < min) throw bad('validation_error', 'Invalid input', [{ path: name, message: '>= ' + min }]);
  if (max !== undefined && n > max) throw bad('validation_error', 'Invalid input', [{ path: name, message: '<= ' + max }]);
  return n;
}
function req(v, name, max) { var s = str(v, max); if (!s) throw bad('validation_error', 'Invalid input', [{ path: name, message: 'required' }]); return s; }
function oneOf(v, list, name) { if (list.indexOf(v) < 0) throw bad('validation_error', 'Invalid input', [{ path: name, message: 'one of ' + list.join(',') }]); return v; }
function sum(arr, f) { return arr.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); }
function sha256Hex(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join(''); }
function paginate(q, def) { var page = Math.max(1, parseInt(q.page || 1, 10) || 1); var size = Math.min(500, Math.max(1, parseInt(q.pageSize || def || 50, 10) || 50)); return { page: page, size: size, slice: function (a) { return a.slice((page - 1) * size, page * size); } }; }
function like(hay, needle) { return String(hay || '').toLowerCase().indexOf(String(needle).toLowerCase()) >= 0; }

// ─────────────────────────────── table layer ───────────────────────────────
// Reads a whole tab once per request; writes are BUFFERED and flushed only after the handler succeeds.
var DB = null;
function db() {
  if (!DB) DB = { tables: {}, pending: [], ss: getSS() };
  return DB;
}
function resetDb() { DB = null; }

function fromCell(v, type) {
  if (v instanceof Date) v = type === 's' && v.getUTCHours() === 0 && v.getUTCMinutes() === 0 ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : v.toISOString();
  switch (type) {
    case 'n': return v === '' || v === null ? 0 : Number(v);
    case 'm': return v === '' || v === null ? 0 : Math.round(Number(v) * 100);
    case 'mn': return v === '' || v === null ? null : Math.round(Number(v) * 100);
    case 'b': return v === true || v === 'TRUE' || v === 'true' || v === 1;
    case 'j': if (v === '' || v === null) return null; try { return JSON.parse(v); } catch (e) { return null; }
    default: return v === null || v === undefined ? '' : String(v);
  }
}
function toCell(v, type) {
  switch (type) {
    case 'n': return v === null || v === undefined || v === '' ? 0 : Number(v);
    case 'm': return egp(v || 0);
    case 'mn': return v === null || v === undefined ? '' : egp(v);
    case 'b': return !!v;
    case 'j': return v === null || v === undefined ? '' : JSON.stringify(v);
    default: return v === null || v === undefined ? '' : String(v);
  }
}

function T(name) {
  var d = db();
  if (d.tables[name]) return d.tables[name];
  var sheet = d.ss.getSheetByName(name);
  if (!sheet) throw new AppError(500, 'not_initialized', 'Spreadsheet is not initialized. Run setup() in Apps Script.');
  var schema = SCHEMA[name];
  var values = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [[]];
  var header = (values[0] || []).map(function (h) { return String(h).trim(); });
  var colOf = {};
  header.forEach(function (h, i) { colOf[h] = i; });
  var rows = [];
  var index = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var id = row[colOf[schema[0][0]]];
    if (id === '' || id === null || id === undefined) continue;
    var o = { _row: r + 1 };
    schema.forEach(function (c) { o[c[1]] = colOf[c[0]] === undefined ? fromCell('', c[2]) : fromCell(row[colOf[c[0]]], c[2]); });
    rows.push(o);
    index[String(o[schema[0][1]])] = o;
  }
  var t = {
    name: name, sheet: sheet, header: header, colOf: colOf, rows: rows, index: index, nextRow: values.length + 1,
    get: function (id) { return id ? index[String(id)] || null : null; },
    all: function () { return rows; },
    find: function (f) { for (var i = 0; i < rows.length; i++) if (f(rows[i])) return rows[i]; return null; },
    filter: function (f) { return rows.filter(f); },
    insert: function (o) {
      var rec = {}; schema.forEach(function (c) { rec[c[1]] = o[c[1]] === undefined ? (c[2] === 'm' || c[2] === 'n' ? 0 : c[2] === 'b' ? false : c[2] === 'mn' || c[2] === 'j' ? null : '') : o[c[1]]; });
      rec._row = t.nextRow++; rows.push(rec); index[String(rec[schema[0][1]])] = rec;
      d.pending.push({ t: t, rec: rec, kind: 'insert' });
      return rec;
    },
    update: function (id, patch) {
      var rec = index[String(id)]; if (!rec) throw notFound();
      Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
      if (!d.pending.some(function (p) { return p.rec === rec; })) d.pending.push({ t: t, rec: rec, kind: 'update' });
      return rec;
    },
  };
  d.tables[name] = t;
  return t;
}

/** Writes every buffered change. Inserts per table go out in one setValues block. */
function flush() {
  var d = db();
  if (!d.pending.length && !d.counters) return;
  var byTable = {};
  d.pending.forEach(function (p) { (byTable[p.t.name] = byTable[p.t.name] || []).push(p); });
  Object.keys(byTable).forEach(function (name) {
    var t = d.tables[name]; var schema = SCHEMA[name];
    var width = t.header.length;
    var toRow = function (rec) {
      if (name === 'Products') rec.stock_status = stockLevel(rec.qty, rec.min_stock).toUpperCase();
      var arr = new Array(width).fill(null);
      schema.forEach(function (c) { if (t.colOf[c[0]] !== undefined) arr[t.colOf[c[0]]] = toCell(rec[c[1]], c[2]); });
      return arr;
    };
    var items = byTable[name].sort(function (a, b) { return a.rec._row - b.rec._row; });
    // contiguous runs → one setValues each (keeps unknown/user columns untouched only for updates of single rows)
    var run = [];
    var writeRun = function () {
      if (!run.length) return;
      var startRow = run[0].rec._row;
      var block = run.map(function (p) {
        var arr = toRow(p.rec);
        if (p.kind === 'update') { // preserve cells of columns AURIX does not own
          var cur = t.sheet.getRange(p.rec._row, 1, 1, width).getValues()[0];
          arr = arr.map(function (v, i) { return v === null ? cur[i] : v; });
        } else arr = arr.map(function (v) { return v === null ? '' : v; });
        return arr;
      });
      t.sheet.getRange(startRow, 1, block.length, width).setValues(block);
      run = [];
    };
    items.forEach(function (p) {
      if (run.length && p.rec._row !== run[run.length - 1].rec._row + 1) writeRun();
      run.push(p);
    });
    writeRun();
  });
  d.pending = [];
  if (d.counters) {
    var props = {}; Object.keys(d.counters).forEach(function (k) { props['counter:' + k] = String(d.counters[k]); });
    PropertiesService.getScriptProperties().setProperties(props);
    d.counters = null;
  }
}

// ─────────────────────────────── settings & counters ───────────────────────────────
var DEFAULT_SETTINGS = {
  'store.name': 'AURIX', 'store.tagline_en': 'Accessories · Fragrance · Beauty', 'store.tagline_ar': 'إكسسوارات · عطور · جمال',
  'store.phone': '', 'store.address_en': '', 'store.address_ar': '', 'store.instagram': '',
  'receipt.footer_en': 'Thank you for shopping at AURIX!', 'receipt.footer_ar': 'شكراً لتسوقكم من أوريكس!',
  'receipt.policy_en': 'Exchanges within 14 days with receipt.', 'receipt.policy_ar': 'الاستبدال خلال ١٤ يوماً بالإيصال.', 'receipt.width': '80',
  'pos.payment_methods': ['cash', 'card', 'instapay', 'vodafone_cash'], 'pos.other_method_label': 'Other',
  'inventory.default_min_stock': 2, 'inventory.reorder_days': 30, 'returns.max_days': 14,
  'expenses.categories': ['Rent', 'Electricity', 'Salaries', 'Supplies', 'Marketing', 'Transport', 'Maintenance', 'Other'], 'currency': 'EGP',
};
var PAYMENT_METHODS = ['cash', 'card', 'instapay', 'vodafone_cash', 'other'];
function getSettings() {
  var out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  T('Settings').all().forEach(function (r) { try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; } });
  return out;
}
function setSetting(key, value) {
  var t = T('Settings');
  if (t.get(key)) t.update(key, { value: JSON.stringify(value), updated_at: nowIso() });
  else t.insert({ key: key, value: JSON.stringify(value), updated_at: nowIso() });
}
function publicSettings() {
  var s = getSettings(); var out = {};
  Object.keys(s).forEach(function (k) { if (/^(store|receipt|pos|currency|returns|expenses\.categories)/.test(k)) out[k] = s[k]; });
  return out;
}
/** Gap-free counters in Script Properties (only called under the script lock). */
function nextCounter(name) {
  var d = db(); d.counters = d.counters || {};
  if (d.counters[name] === undefined) d.counters[name] = parseInt(PropertiesService.getScriptProperties().getProperty('counter:' + name) || '0', 10);
  return ++d.counters[name];
}
