// ─────────────────────────────── reports ───────────────────────────────
function resolveRange(q) {
  var today = localDate();
  switch (q.preset || 'today') {
    case 'today': return { from: today, to: today };
    case 'yesterday': var y = addDays(today, -1); return { from: y, to: y };
    case 'week': var dow = new Date(today + 'T12:00:00Z').getUTCDay(); return { from: addDays(today, -((dow + 1) % 7)), to: today }; // week starts Saturday
    case 'month': return { from: today.slice(0, 8) + '01', to: today };
    case 'last30': return { from: addDays(today, -29), to: today };
    case 'year': return { from: today.slice(0, 5) + '01-01', to: today };
    case 'custom': if (!isYmd(q.from) || !isYmd(q.to) || q.from > q.to) throw bad('invalid_range'); return { from: q.from, to: q.to };
    default: throw bad('invalid_range');
  }
}
function inRange(d, from, to) { return d >= from && d <= to; }

function reportSummary(from, to) {
  var S = T('Sales').filter(function (s) { return inRange(s.local_date, from, to); });
  var R = T('Returns').filter(function (r) { return inRange(r.local_date, from, to); });
  var E = T('Expenses').filter(function (e) { return e.status === 'active' && inRange(e.expense_date, from, to); });
  var saleIds = {}; S.forEach(function (s) { saleIds[s.id] = 1; });
  var I = T('SaleItems').filter(function (i) { return saleIds[i.sale_id]; });
  var gross = sum(S, function (s) { return s.total; }), refunds = sum(R, function (r) { return r.refund_total; });
  var cogs = sum(S, function (s) { return s.cost_total; }) - sum(R, function (r) { return r.cost_restored; });
  var net = gross - refunds, gp = net - cogs, exp = sum(E, function (e) { return e.amount; });
  var P = T('Products').filter(function (p) { return p.status === 'active'; });

  var methods = {};
  S.forEach(function (s) { var seen = {}; (s.payments || []).forEach(function (p) { var m = methods[p.method] = methods[p.method] || { method: p.method, sales: 0, refunds: 0, count: 0 }; m.sales += p.amount; if (!seen[p.method]) { m.count++; seen[p.method] = 1; } }); });
  R.forEach(function (r) { var m = methods[r.refund_method] = methods[r.refund_method] || { method: r.refund_method, sales: 0, refunds: 0, count: 0 }; m.refunds += r.refund_total; });
  var cashiers = {}; S.forEach(function (s) { var c = cashiers[s.cashier_id] = cashiers[s.cashier_id] || { id: s.cashier_id, name: s.cashier_name, invoices: 0, gross: 0 }; c.invoices++; c.gross += s.total; });
  var prod = {}; I.forEach(function (i) { var p = prod[i.product_id] = prod[i.product_id] || { product_id: i.product_id, sku: i.sku, name_en: i.name_en, name_ar: i.name_ar, units: 0, revenue: 0, profit: 0 };
    var u = i.qty - i.returned_qty, rev = i.net_total - i.refunded_amount; p.units += u; p.revenue += rev; p.profit += rev - u * i.unit_cost; });
  var prodList = Object.keys(prod).map(function (k) { return prod[k]; }).filter(function (p) { return p.units > 0; });
  var cats = {}; I.forEach(function (i) { var pr = T('Products').get(i.product_id) || {}; var c = catOf(pr.category_id); var k = c ? c.id : '';
    var x = cats[k] = cats[k] || { id: c ? c.id : null, name_en: c ? c.name_en : null, name_ar: c ? c.name_ar : null, units: 0, revenue: 0, profit: 0 };
    var u = i.qty - i.returned_qty, rev = i.net_total - i.refunded_amount; x.units += u; x.revenue += rev; x.profit += rev - u * i.unit_cost; });
  var expCat = {}; E.forEach(function (e) { expCat[e.category] = (expCat[e.category] || 0) + e.amount; });
  var start = from > addDays(to, -91) ? from : addDays(to, -91);
  var daily = []; for (var d = start; d <= to; d = addDays(d, 1)) daily.push(d);
  var allS = T('Sales').all(), allR = T('Returns').all();
  daily = daily.map(function (day) {
    var ss = allS.filter(function (s) { return s.local_date === day; }); var g = sum(ss, function (s) { return s.total; });
    return { date: day, gross: g, net: g - sum(allR.filter(function (r) { return r.local_date === day; }), function (r) { return r.refund_total; }), invoices: ss.length };
  });
  return {
    range: { from: from, to: to },
    sales: { invoices: S.length, gross: gross, subtotal: sum(S, function (s) { return s.subtotal; }), discounts: sum(S, function (s) { return s.line_discount + s.order_discount; }),
      refunds: refunds, cancellations: sum(R.filter(function (r) { return r.kind === 'cancellation'; }), function (r) { return r.refund_total; }), returns_count: R.length,
      net: net, avg_ticket: S.length ? Math.round(gross / S.length) : 0, units: sum(I, function (i) { return i.qty; }) },
    profit: { cogs: cogs, gross_profit: gp, margin_pct: net ? Math.round(gp / net * 1000) / 10 : 0, expenses: exp, net_profit: gp - exp },
    inventory: { products: P.length, units: sum(P, function (p) { return p.qty; }), cost_value: sum(P, function (p) { return p.qty * p.cost_price; }), retail_value: sum(P, function (p) { return p.qty * p.sell_price; }),
      out_count: P.filter(function (p) { return p.qty === 0; }).length, low_count: P.filter(function (p) { return p.qty > 0 && p.qty <= p.min_stock; }).length,
      open_alerts: T('InventoryAlerts').filter(function (a) { return a.status === 'open'; }).length },
    by_method: Object.keys(methods).map(function (k) { var m = methods[k]; m.net = m.sales - m.refunds; return m; }),
    by_cashier: Object.keys(cashiers).map(function (k) { return cashiers[k]; }).sort(function (a, b) { return b.gross - a.gross; }),
    best_sellers: prodList.slice().sort(function (a, b) { return b.units - a.units || b.revenue - a.revenue; }).slice(0, 10),
    most_profitable: prodList.slice().sort(function (a, b) { return b.profit - a.profit; }).slice(0, 10),
    by_category: Object.keys(cats).map(function (k) { return cats[k]; }).sort(function (a, b) { return b.revenue - a.revenue; }),
    expenses_by_category: Object.keys(expCat).map(function (k) { return { category: k, total: expCat[k] }; }).sort(function (a, b) { return b.total - a.total; }),
    recent_sales: S.slice().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 8)
      .map(function (s) { return { id: s.id, invoice_no: s.invoice_no, total: s.total, status: s.status, payment_summary: s.payment_summary, created_at: s.created_at, cashier_name: s.cashier_name }; }),
    daily: daily,
  };
}
function reportsSummary(rq) { requirePerm(rq.user, 'reports.view'); var r = resolveRange(rq.query); return reportSummary(r.from, r.to); }
function reportsMonthly(rq) {
  requirePerm(rq.user, 'reports.view');
  var today = localDate(); var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)); var out = [];
  var S = T('Sales').all(), R = T('Returns').all(), E = T('Expenses').filter(function (e) { return e.status === 'active'; });
  for (var k = 0; k < 12; k++) {
    var key = y + '-' + String(m).padStart(2, '0');
    var ss = S.filter(function (s) { return s.local_date.slice(0, 7) === key; }), rr = R.filter(function (r) { return r.local_date.slice(0, 7) === key; });
    var net = sum(ss, function (s) { return s.total; }) - sum(rr, function (r) { return r.refund_total; });
    out.unshift({ month: key, gross: sum(ss, function (s) { return s.total; }), net: net,
      gross_profit: net - (sum(ss, function (s) { return s.cost_total; }) - sum(rr, function (r) { return r.cost_restored; })),
      expenses: sum(E.filter(function (e) { return e.expense_date.slice(0, 7) === key; }), function (e) { return e.amount; }) });
    if (--m === 0) { m = 12; y--; }
  }
  return { rows: out };
}
