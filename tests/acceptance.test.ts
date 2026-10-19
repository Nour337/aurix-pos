/**
 * AURIX acceptance tests A–H (spec §17). Test I (languages) lives in i18n.test.ts + the Playwright e2e run.
 * The tests run in order and share state, exactly like the real-shop scenario in the spec.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, sell, txn, MANAGER_PW } from './helpers.js';

let T: Awaited<ReturnType<typeof setup>>;
let productId = '';
const sales: { id: string; invoice: string; itemId: string }[] = [];
const qtyOf = async () => (await T.manager.get(`/api/products/${productId}`)).body.product.qty;

beforeAll(async () => {
  T = await setup();
  const r = await T.cashier.post('/api/shifts/open', { opening_cash: 50000 });
  expect(r.status).toBe(201);
});

describe('A — create a product', () => {
  it('creates Rose Body Splash with SKU AUR-0001', async () => {
    const r = await T.manager.post('/api/products', { sku: 'AUR-0001', name_en: 'Rose Body Splash', name_ar: 'بودي سبلاش الورد', cost_price: 10000, sell_price: 15000, initial_qty: 5, min_stock: 2 });
    expect(r.status).toBe(201);
    productId = r.body.id;
    expect(r.body).toMatchObject({ sku: 'AUR-0001', name_en: 'Rose Body Splash', cost_price: 10000, sell_price: 15000, qty: 5, min_stock: 2, stock_level: 'normal' });
    const mv = await T.manager.get(`/api/inventory/movements?productId=${productId}`);
    expect(mv.body.rows).toHaveLength(1);
    expect(mv.body.rows[0]).toMatchObject({ type: 'initial', qty_change: 5, qty_after: 5 });
  });
  it('rejects a duplicate SKU instead of overwriting', async () => {
    const r = await T.manager.post('/api/products', { sku: 'aur-0001', name_en: 'Another', sell_price: 100 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('duplicate_sku');
    expect(await qtyOf()).toBe(5);
  });
  it('auto-generates unique SKUs when none is given', async () => {
    const r = await T.manager.post('/api/products', { name_en: 'Gold Hoop Earrings', sell_price: 25000, cost_price: 12000, initial_qty: 10 });
    expect(r.status).toBe(201);
    expect(r.body.sku).toMatch(/^AUR-\d{4}$/);
    expect(r.body.sku).not.toBe('AUR-0001');
  });
  it('blocks direct quantity edits (must use adjustments)', async () => {
    const r = await T.manager.patch(`/api/products/${productId}`, { qty: 99 });
    expect(r.status).toBe(400);
    expect(await qtyOf()).toBe(5);
  });
});

describe('B — search', () => {
  it('finds the product by name, SKU, Arabic name and returns correct price/stock', async () => {
    const byName = await T.cashier.get('/api/products?q=' + encodeURIComponent('Rose Body Splash'));
    const bySku = await T.cashier.get('/api/products?q=AUR-0001');
    const byAr = await T.cashier.get('/api/products?q=' + encodeURIComponent('الورد'));
    for (const r of [byName, bySku, byAr]) {
      expect(r.status).toBe(200);
      expect(r.body.rows[0]).toMatchObject({ id: productId, sell_price: 15000, qty: 5 });
    }
    const lookup = await T.cashier.get('/api/products/lookup/AUR-0001');
    expect(lookup.body.id).toBe(productId);
  });
});

describe('C — complete a sale', () => {
  it('sells 1 unit for 150 EGP, deducts stock 5 → 4, creates invoice', async () => {
    const r = await sell(T.cashier, productId, 1, 15000);
    expect(r.status).toBe(201);
    expect(r.body.sale.invoice_no).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(r.body.sale.total).toBe(15000);
    expect(r.body.payments).toEqual([{ method: 'cash', amount: 15000, reference: '' }]);
    sales.push({ id: r.body.sale.id, invoice: r.body.sale.invoice_no, itemId: r.body.items[0].id });
    expect(await qtyOf()).toBe(4);
  });
  it('dashboard & sales report reflect the sale', async () => {
    const d = await T.manager.get('/api/reports/summary?preset=today');
    expect(d.status).toBe(200);
    expect(d.body.sales).toMatchObject({ invoices: 1, gross: 15000, net: 15000, refunds: 0 });
    expect(d.body.profit).toMatchObject({ cogs: 10000, gross_profit: 5000 });
    expect(d.body.by_method.find((m: any) => m.method === 'cash').net).toBe(15000);
    const list = await T.manager.get('/api/sales?preset=today');
    expect(list.body.rows.map((s: any) => s.invoice_no)).toContain(sales[0].invoice);
  });
  it('computes change and records only net cash in the drawer', async () => {
    const r = await T.cashier.post('/api/sales/checkout', { client_txn_id: txn(), items: [{ product_id: productId, qty: 1 }], payments: [{ method: 'cash', amount: 20000 }] });
    expect(r.status).toBe(201);
    expect(r.body.sale.change_due).toBe(5000);
    expect(r.body.payments[0].amount).toBe(15000);
    sales.push({ id: r.body.sale.id, invoice: r.body.sale.invoice_no, itemId: r.body.items[0].id });
    const sh = await T.cashier.get('/api/shifts/current');
    expect(sh.body.expected_cash).toBe(50000 + 30000);
    expect(await qtyOf()).toBe(3);
  });
});

describe('D — low-stock alert', () => {
  it('stock 3 → 2 triggers exactly one LOW STOCK alert', async () => {
    const r = await sell(T.cashier, productId, 1, 15000);
    expect(r.status).toBe(201);
    sales.push({ id: r.body.sale.id, invoice: r.body.sale.invoice_no, itemId: r.body.items[0].id });
    expect(await qtyOf()).toBe(2);
    expect(r.body.alerts).toHaveLength(1);
    expect(r.body.alerts[0]).toMatchObject({ type: 'low_stock', qty: 2 });
  });
  it('manager sees it; repeated refreshes never duplicate it', async () => {
    for (let i = 0; i < 5; i++) {
      const a = await T.manager.get('/api/inventory/alerts');
      expect(a.body.rows.filter((x: any) => x.product_id === productId)).toHaveLength(1);
    }
    const s = await T.manager.get('/api/inventory/alerts/summary');
    expect(s.body).toMatchObject({ low: 1, out: 0 });
    const d = await T.manager.get('/api/reports/summary?preset=today');
    expect(d.body.inventory.low_count).toBe(1);
  });
  it('reviewing does not pretend stock was replenished', async () => {
    const a = (await T.manager.get('/api/inventory/alerts')).body.rows[0];
    expect((await T.manager.post(`/api/inventory/alerts/${a.id}/review`)).status).toBe(200);
    const after = (await T.manager.get('/api/inventory/alerts')).body.rows[0];
    expect(after).toMatchObject({ id: a.id, status: 'reviewed', current_qty: 2 });
    expect(after.suggested).toBeGreaterThan(0);
  });
});

describe('E — out of stock', () => {
  it('selling the last 2 units → 0 and an OUT OF STOCK alert', async () => {
    const r = await sell(T.cashier, productId, 2, 15000);
    expect(r.status).toBe(201);
    sales.push({ id: r.body.sale.id, invoice: r.body.sale.invoice_no, itemId: r.body.items[0].id });
    expect(await qtyOf()).toBe(0);
    expect(r.body.alerts[0]).toMatchObject({ type: 'out_of_stock', qty: 0 });
    const active = (await T.manager.get('/api/inventory/alerts')).body.rows.filter((x: any) => x.product_id === productId);
    expect(active).toHaveLength(1);
    expect(active[0].type).toBe('out_of_stock');
  });
  it('blocks any further sale and leaves no partial records', async () => {
    const before = (await T.manager.get('/api/sales')).body.total;
    const r = await sell(T.cashier, productId, 1, 15000);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('insufficient_stock');
    expect(await qtyOf()).toBe(0);
    expect((await T.manager.get('/api/sales')).body.total).toBe(before);
  });
  it('two simultaneous sales for the last unit: exactly one succeeds', async () => {
    const p = await T.manager.post('/api/products', { name_en: 'Last Unit Mist', sell_price: 9000, cost_price: 4000, initial_qty: 1 });
    const [a, b] = await Promise.all([sell(T.cashier, p.body.id, 1, 9000), sell(T.cashier, p.body.id, 1, 9000)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await T.manager.get(`/api/products/${p.body.id}`)).body.product.qty).toBe(0);
  });
});

describe('F — return', () => {
  it('returns 1 unit from the first invoice, restocks it and updates reports', async () => {
    const lookup = await T.cashier.get(`/api/sales/by-invoice/${sales[0].invoice}`);
    expect(lookup.status).toBe(200);
    // cashier has no return permission → needs manager approval on the spot
    const denied = await T.cashier.post('/api/returns', { client_txn_id: txn(), sale_id: sales[0].id, items: [{ sale_item_id: sales[0].itemId, qty: 1, restock: true }], refund_method: 'cash', reason: 'Customer changed mind' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('manager_approval_required');
    const r = await T.cashier.post('/api/returns', { client_txn_id: txn(), sale_id: sales[0].id, items: [{ sale_item_id: sales[0].itemId, qty: 1, restock: true }], refund_method: 'cash', reason: 'Customer changed mind', manager_approval: { username: 'admin', password: MANAGER_PW } });
    expect(r.status).toBe(201);
    expect(r.body.return).toMatchObject({ invoice_no: sales[0].invoice, sale_id: sales[0].id, refund_total: 15000, kind: 'return' });
    expect(r.body.sale_status).toBe('returned');
    expect(await qtyOf()).toBe(1);
    const d = await T.manager.get('/api/reports/summary?preset=today');
    expect(d.body.sales.refunds).toBe(15000);
    expect(d.body.sales.net).toBe(d.body.sales.gross - 15000);
    // original transaction preserved
    const orig = await T.manager.get(`/api/sales/${sales[0].id}`);
    expect(orig.body.sale.total).toBe(15000);
    expect(orig.body.returns).toHaveLength(1);
    // stock back to 1 → out-of-stock alert becomes low-stock
    const active = (await T.manager.get('/api/inventory/alerts')).body.rows.filter((x: any) => x.product_id === productId);
    expect(active.map((a: any) => a.type)).toEqual(['low_stock']);
    const sh = await T.cashier.get('/api/shifts/current');
    expect(sh.body.cash.refunds).toBe(-15000);
  });
  it('the same quantity cannot be returned twice', async () => {
    const r = await T.manager.post('/api/returns', { client_txn_id: txn(), sale_id: sales[0].id, items: [{ sale_item_id: sales[0].itemId, qty: 1 }], refund_method: 'card', reason: 'Second try' });
    expect(r.status).toBe(409);
    expect(await qtyOf()).toBe(1);
  });
  it('partial returns never exceed the remaining quantity', async () => {
    const s = sales[3]; // sold 2
    const ok = await T.manager.post('/api/returns', { client_txn_id: txn(), sale_id: s.id, items: [{ sale_item_id: s.itemId, qty: 1, restock: false }], refund_method: 'card', reason: 'Damaged box' });
    expect(ok.status).toBe(201);
    expect(ok.body.sale_status).toBe('partially_returned');
    const tooMany = await T.manager.post('/api/returns', { client_txn_id: txn(), sale_id: s.id, items: [{ sale_item_id: s.itemId, qty: 2 }], refund_method: 'card', reason: 'Too many' });
    expect(tooMany.status).toBe(409);
    expect(await qtyOf()).toBe(1); // not restocked (damaged)
  });
});

describe('G — permissions (server-side)', () => {
  it('cashier cannot edit cost prices, inventory, users or see profit reports', async () => {
    const c = T.cashier;
    expect((await c.patch(`/api/products/${productId}`, { cost_price: 1 })).status).toBe(403);
    expect((await c.post('/api/products', { name_en: 'Hack', sell_price: 1 })).status).toBe(403);
    expect((await c.post('/api/inventory/adjust', { productId, newQty: 50, reason: 'hack' })).status).toBe(403);
    expect((await c.get('/api/reports/summary')).status).toBe(403);
    expect((await c.get('/api/users')).status).toBe(403);
    expect((await c.get('/api/admin/audit')).status).toBe(403);
    expect((await c.get('/api/admin/export/sales')).status).toBe(403);
    expect((await c.post('/api/purchases', { client_txn_id: txn(), items: [{ product_id: productId, qty: 5, unit_cost: 1 }] })).status).toBe(403);
    const p = await c.get('/api/products?q=AUR-0001');
    expect(p.body.rows[0].cost_price).toBeUndefined();
    const s = await c.get(`/api/sales/${sales[1].id}`);
    expect(s.body.sale.cost_total).toBeUndefined();
    expect(s.body.items[0].unit_cost).toBeUndefined();
    // cancel without approval
    const cancel = await c.post(`/api/sales/${sales[1].id}/cancel`, { client_txn_id: txn(), refund_method: 'cash', reason: 'mistake' });
    expect(cancel.status).toBe(403);
    // price tampering is impossible: the client never sends prices
    const r = await c.post('/api/sales/checkout', { client_txn_id: txn(), items: [{ product_id: productId, qty: 1, unit_price: 1 }], payments: [{ method: 'cash', amount: 100 }] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('insufficient_payment');
    // unauthorized discount needs approval
    const disc = await c.post('/api/sales/checkout', { client_txn_id: txn(), items: [{ product_id: productId, qty: 1 }], order_discount: 5000, payments: [{ method: 'cash', amount: 10000 }] });
    expect(disc.status).toBe(403);
    expect(await qtyOf()).toBe(1);
  });
  it('requests without a valid session token are rejected', async () => {
    const anon = T.newClient();
    expect((await anon.post('/api/shifts/open', { opening_cash: 0 })).status).toBe(401);
    expect((await anon.get('/api/products')).status).toBe(401);
  });
  it('manager has full inventory & reporting access', async () => {
    const m = T.manager;
    expect((await m.get('/api/reports/summary?preset=month')).status).toBe(200);
    expect((await m.get('/api/products?q=AUR-0001')).body.rows[0].cost_price).toBe(10000);
    const pur = await m.post('/api/purchases', { client_txn_id: txn(), reference: 'SUP-INV-77', items: [{ product_id: productId, qty: 6, unit_cost: 11000 }] });
    expect(pur.status).toBe(201);
    expect(await qtyOf()).toBe(7);
    // replenished above threshold → alert auto-resolved
    const active = (await m.get('/api/inventory/alerts')).body.rows.filter((x: any) => x.product_id === productId);
    expect(active).toHaveLength(0);
    // moving-average cost: (1×100 + 6×110) / 7 = 108.57
    expect((await m.get(`/api/products/${productId}`)).body.product.cost_price).toBe(10857);
    const adj = await m.post('/api/inventory/adjust', { productId, newQty: 6, reason: 'Broken bottle' });
    expect(adj.status).toBe(200);
    expect(adj.body).toMatchObject({ before: 7, after: 6 });
    expect((await m.get('/api/admin/audit?action=stock.adjust')).body.rows[0].details).toContain('Broken bottle');
  });
  it('a cashier granted returns.process can return without approval', async () => {
    await T.manager.patch(`/api/users/${T.cashierId}`, { permissions: ['returns.process'] });
    const r = await T.cashier.post('/api/returns', { client_txn_id: txn(), sale_id: sales[2].id, items: [{ sale_item_id: sales[2].itemId, qty: 1 }], refund_method: 'cash', reason: 'Wrong scent' });
    expect(r.status).toBe(201);
  });
});

describe('H — Google Sheets is the database', () => {
  const tab = (n: string) => T.ss.table(n);
  it('records land in their correct tabs', async () => {
    const tabs = [...T.ss.sheets.keys()];
    for (const t of ['Settings', 'Users', 'Products', 'Categories', 'Suppliers', 'Sales', 'SaleItems', 'Purchases', 'PurchaseItems', 'StockMovements', 'Returns', 'ReturnItems', 'Expenses', 'CashierShifts', 'CashMovements', 'InventoryAlerts', 'AuditLogs']) expect(tabs).toContain(t);
    const prod = tab('Products').find((r) => r.SKU === 'AUR-0001')!;
    expect(prod).toMatchObject({ ProductID: productId, SellPrice: 150, CostPrice: 108.57, Quantity: 7, StockStatus: 'NORMAL' });
    expect(tab('Sales').map((r) => r.InvoiceNumber)).toContain(sales[0].invoice);
    expect(tab('SaleItems').filter((r) => r.SaleID === sales[0].id)).toHaveLength(1);
    expect(tab('StockMovements').filter((r) => r.ProductID === productId && r.Type === 'sale')).toHaveLength(4);
    expect(tab('Returns').find((r) => r.SaleID === sales[0].id)).toMatchObject({ InvoiceNumber: sales[0].invoice, RefundTotal: 150 });
    // password hashes live in Script Properties, never in the sheet
    expect(JSON.stringify(tab('Users'))).not.toMatch(/h1\$/);
    expect([...T.gas.props.keys()].some((k) => k.startsWith('pw:'))).toBe(true);
  });
  it('retrying a processed transaction does not deduct stock twice', async () => {
    const body = { client_txn_id: txn(), items: [{ product_id: productId, qty: 1 }], payments: [{ method: 'card', amount: 15000 }] };
    const a = await T.cashier.post('/api/sales/checkout', body);
    const b = await T.cashier.post('/api/sales/checkout', body);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.duplicate).toBe(true);
    expect(b.body.sale.id).toBe(a.body.sale.id);
    expect(await qtyOf()).toBe(6); // 7 − 1, deducted exactly once
    const reused = await T.cashier.post('/api/sales/checkout', { ...body, items: [{ product_id: productId, qty: 2 }] });
    expect(reused.status).toBe(409);
    expect(tab('Sales').filter((r) => r.ClientTxnID === body.client_txn_id)).toHaveLength(1);
  });
  it('a rejected sale writes nothing at all', async () => {
    const before = Object.fromEntries([...T.ss.sheets.keys()].map((k) => [k, tab(k).length]));
    const r = await T.cashier.post('/api/sales/checkout', { client_txn_id: txn(), items: [{ product_id: productId, qty: 1 }, { product_id: 'prd_missing', qty: 1 }], payments: [{ method: 'cash', amount: 99999 }] });
    expect(r.status).toBe(404);
    for (const k of Object.keys(before)) if (k !== 'AuditLogs') expect(tab(k).length).toBe(before[k]);
    expect(await qtyOf()).toBe(6);
  });
  it('a Google Sheets outage is visible and the retry is safe', async () => {
    const txnId = txn();
    const body = { client_txn_id: txnId, items: [{ product_id: productId, qty: 1 }], payments: [{ method: 'cash', amount: 15000 }] };
    T.ss.failWrites = true;
    const failed = await T.cashier.post('/api/sales/checkout', body);
    expect(failed.status).toBe(500);
    expect(failed.body.error.message).toMatch(/outage/);
    T.ss.failWrites = false;
    expect(await qtyOf()).toBe(6);
    const ok = await T.cashier.post('/api/sales/checkout', body); // the POS retries with the same transaction ID
    expect(ok.status).toBe(201);
    expect(await qtyOf()).toBe(5);
    expect(tab('Sales').filter((r) => r.ClientTxnID === txnId)).toHaveLength(1);
  });
  it('re-initialization is safe: never wipes data, adds missing headers, keeps user columns', async () => {
    const before = tab('Sales').length;
    const hdr = T.ss.sheets.get('Products')!.grid[0];
    hdr.push('MyCustomColumn');
    hdr.splice(hdr.indexOf('Brand'), 1, 'BrandX');
    const init = await T.manager.post('/api/admin/sheets/init');
    expect(init.status).toBe(200);
    expect(init.body.headersAdded.Products).toEqual(['Brand']);
    expect(tab('Sales').length).toBe(before);
    expect(T.ss.sheets.get('Products')!.grid[0]).toContain('MyCustomColumn');
    // writes still work against the changed header layout
    expect((await T.manager.patch(`/api/products/${productId}`, { brand: 'AURIX' })).status).toBe(200);
    expect(tab('Products').find((r) => r.SKU === 'AUR-0001')).toMatchObject({ Brand: 'AURIX', Quantity: 5 });
  });
  it('status page lists every tab', async () => {
    const r = await T.manager.get('/api/admin/sheets');
    expect(r.body.ok).toBe(true);
    expect(r.body.tabs).toHaveLength(17);
  });
});

describe('Integrity, shifts & misc', () => {
  it('closing a shift computes the cash difference', async () => {
    const cur = (await T.cashier.get('/api/shifts/current')).body;
    await T.cashier.post(`/api/shifts/${cur.shift.id}/cash`, { type: 'cash_out', amount: 1000, reason: 'Change for customer' });
    const exp = (await T.cashier.get('/api/shifts/current')).body.expected_cash;
    const closed = await T.cashier.post(`/api/shifts/${cur.shift.id}/close`, { counted_cash: exp - 500 });
    expect(closed.body.shift).toMatchObject({ status: 'closed', expected_cash: exp, counted_cash: exp - 500, difference: -500 });
    const blocked = await sell(T.cashier, productId, 1, 15000);
    expect(blocked.body.error.code).toBe('shift_required');
  });
  it('the integrity report is clean', async () => {
    const r = await T.manager.get('/api/admin/integrity');
    const bad = r.body.checks.filter((c: any) => c.count > 0);
    expect(bad).toEqual([]);
    expect(r.body.ok).toBe(true);
  });
  it('CSV export respects filters and neutralizes formulas', async () => {
    await T.manager.post('/api/products', { name_en: '=HYPERLINK("http://evil")', sell_price: 100 });
    const r = await T.manager.get('/api/admin/export/products?q=HYPERLINK');
    expect(r.status).toBe(200);
    expect(r.body.csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(r.body.csv.split('\r\n')).toHaveLength(2);
  });
  it('login brute-force is throttled', async () => {
    const c = T.newClient();
    for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { username: 'sara', password: 'wrong' });
    const r = await c.post('/api/auth/login', { username: 'sara', password: 'wrong' });
    expect(r.status).toBe(429);
  });
});
