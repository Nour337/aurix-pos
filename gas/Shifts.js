// ─────────────────────────────── shifts ───────────────────────────────
function shiftSummary(id) {
  var sh = T('CashierShifts').get(id); if (!sh) return null;
  var mv = T('CashMovements').filter(function (c) { return c.shift_id === id; });
  var by = {}; mv.forEach(function (c) { by[c.type] = (by[c.type] || 0) + c.amount; });
  var sales = T('Sales').filter(function (s) { return s.shift_id === id; });
  var methods = {}; sales.forEach(function (s) { (s.payments || []).forEach(function (p) { methods[p.method] = (methods[p.method] || 0) + p.amount; }); });
  var refunds = {}; T('Returns').filter(function (r) { return r.shift_id === id; }).forEach(function (r) { refunds[r.refund_method] = (refunds[r.refund_method] || 0) + r.refund_total; });
  var closer = sh.closed_by ? T('Users').get(sh.closed_by) : null;
  var shift = clean(sh); shift.closed_by_name = closer ? closer.display_name : null;
  ['closed_at', 'closed_by'].forEach(function (k) { if (!shift[k]) shift[k] = null; });
  return {
    shift: shift, expected_cash: sh.opening_cash + sum(mv, function (c) { return c.amount; }),
    cash: { opening: sh.opening_cash, sales: by.sale || 0, refunds: by.refund || 0, cash_in: by.cash_in || 0, cash_out: by.cash_out || 0, expenses: by.expense || 0 },
    sales_count: sales.length, sales_total: sum(sales, function (s) { return s.total; }),
    payments_by_method: Object.keys(methods).map(function (k) { return { method: k, total: methods[k] }; }),
    refunds_by_method: Object.keys(refunds).map(function (k) { return { method: k, total: refunds[k] }; }),
    movements: mv.sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).slice(0, 200).map(clean),
  };
}
function shiftsCurrent(rq) { requirePerm(rq.user, 'shifts.own'); var s = openShiftFor(rq.user.id); return s ? shiftSummary(s.id) : null; }
function shiftsOpen(rq) {
  requirePerm(rq.user, 'shifts.own');
  var cash = int(rq.body.opening_cash, 'opening_cash', 0, 100000000);
  if (openShiftFor(rq.user.id)) throw conflict('shift_already_open');
  var id = newId('shf'); var day = localDate();
  var no = 'SH-' + day.replace(/-/g, '') + '-' + String(nextCounter('shift:' + day)).padStart(2, '0');
  T('CashierShifts').insert({ id: id, shift_no: no, user_id: rq.user.id, user_name: rq.user.display_name, opened_at: nowIso(), opening_cash: cash, status: 'open', notes: str(rq.body.notes, 300) });
  audit(rq.user, 'shift.open', 'CashierShifts', id, { no: no, opening_cash: cash });
  rq.status = 201;
  return shiftSummary(id);
}
function ownOrManager(rq, sh) { if (sh.user_id !== rq.user.id && !can(rq.user, 'shifts.manage')) throw forbidden(); }
function shiftsCash(rq) {
  requirePerm(rq.user, 'shifts.own');
  var sh = T('CashierShifts').get(rq.params.id); if (!sh) throw notFound(); ownOrManager(rq, sh);
  if (sh.status !== 'open') throw conflict('shift_closed');
  var type = oneOf(rq.body.type, ['cash_in', 'cash_out'], 'type'); var amount = int(rq.body.amount, 'amount', 1, 100000000);
  var reason = str(rq.body.reason, 200); if (reason.length < 3) throw bad('validation_error', 'Invalid input', [{ path: 'reason' }]);
  if (type === 'cash_out' && amount > shiftSummary(sh.id).expected_cash) throw bad('cash_out_exceeds_drawer', 'Not enough cash in the drawer');
  T('CashMovements').insert({ id: newId('csh'), shift_id: sh.id, type: type, amount: type === 'cash_in' ? amount : -amount, reason: reason, user_id: rq.user.id, user_name: rq.user.display_name, created_at: nowIso() });
  audit(rq.user, 'shift.' + type, 'CashierShifts', sh.id, rq.body);
  return shiftSummary(sh.id);
}
function shiftsClose(rq) {
  requirePerm(rq.user, 'shifts.own');
  var sh = T('CashierShifts').get(rq.params.id); if (!sh) throw notFound(); ownOrManager(rq, sh);
  if (sh.status !== 'open') throw conflict('shift_closed');
  var counted = int(rq.body.counted_cash, 'counted_cash', 0, 100000000);
  var s = shiftSummary(sh.id);
  T('CashierShifts').update(sh.id, { status: 'closed', closed_at: nowIso(), expected_cash: s.expected_cash, counted_cash: counted, difference: counted - s.expected_cash,
    notes: [sh.notes, str(rq.body.notes, 300)].filter(Boolean).join(' | '), closed_by: rq.user.id });
  audit(rq.user, 'shift.close', 'CashierShifts', sh.id, { expected: s.expected_cash, counted: counted, difference: counted - s.expected_cash });
  return shiftSummary(sh.id);
}
function shiftsList(rq) {
  requirePerm(rq.user, 'shifts.own', 'shifts.manage');
  var q = rq.query; var mgr = can(rq.user, 'shifts.manage');
  var rows = T('CashierShifts').filter(function (s) {
    if (!mgr && s.user_id !== rq.user.id) return false;
    if (mgr && q.user && s.user_id !== q.user) return false;
    if (q.status && s.status !== q.status) return false;
    return true;
  }).sort(function (a, b) { return b.opened_at.localeCompare(a.opened_at); });
  var sales = T('Sales').all();
  var pg = paginate(q, 30);
  return { total: rows.length, rows: pg.slice(rows).map(function (s) {
    var mine = sales.filter(function (x) { return x.shift_id === s.id; });
    var o = clean(s); o.sales_count = mine.length; o.sales_total = sum(mine, function (x) { return x.total; });
    if (s.status === 'open') o.expected_cash = shiftSummary(s.id).expected_cash;
    return o;
  }) };
}
function shiftsGet(rq) {
  requirePerm(rq.user, 'shifts.own', 'shifts.manage');
  var s = shiftSummary(rq.params.id); if (!s) throw notFound();
  ownOrManager(rq, s.shift); return s;
}

// ─────────────────────────────── expenses ───────────────────────────────
function expensesCreate(rq) {
  requirePerm(rq.user, 'expenses.create', 'expenses.manage');
  var b = rq.body; var cats = getSettings()['expenses.categories'];
  var category = req(b.category, 'category', 40); if (cats.indexOf(category) < 0) throw bad('unknown_expense_category');
  var amount = int(b.amount, 'amount', 1, 100000000); var method = oneOf(b.payment_method, PAYMENT_METHODS, 'payment_method');
  var shift = b.from_drawer ? openShiftFor(rq.user.id) : null;
  if (b.from_drawer && (!shift || method !== 'cash')) throw conflict('shift_required', 'Drawer expenses must be cash and need an open shift');
  if (shift && amount > shiftSummary(shift.id).expected_cash) throw bad('cash_out_exceeds_drawer', 'Not enough cash in the drawer');
  var id = newId('exp');
  var rec = T('Expenses').insert({ id: id, expense_date: isYmd(b.expense_date) ? b.expense_date : localDate(), category: category, description: str(b.description, 300), amount: amount,
    payment_method: method, reference: str(b.reference, 80), user_id: rq.user.id, user_name: rq.user.display_name, shift_id: shift ? shift.id : '', status: 'active', void_reason: '', created_at: nowIso() });
  if (shift) T('CashMovements').insert({ id: newId('csh'), shift_id: shift.id, type: 'expense', amount: -amount, reason: (category + ': ' + rec.description).slice(0, 200), ref_id: id, user_id: rq.user.id, user_name: rq.user.display_name, created_at: nowIso() });
  audit(rq.user, 'expense.create', 'Expenses', id, b);
  rq.status = 201; return clean(rec);
}
function expensesList(rq) {
  requirePerm(rq.user, 'expenses.create', 'expenses.manage');
  var q = rq.query; var mgr = can(rq.user, 'expenses.manage');
  var rows = T('Expenses').filter(function (e) {
    if (!mgr && e.user_id !== rq.user.id) return false;
    if (q.from && e.expense_date < q.from) return false; if (q.to && e.expense_date > q.to) return false;
    if (q.category && e.category !== q.category) return false; if (q.method && e.payment_method !== q.method) return false;
    if (q.status && e.status !== q.status) return false;
    if (q.q && ![e.description, e.reference].some(function (v) { return like(v, q.q); })) return false;
    return true;
  }).sort(function (a, b) { return b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at); });
  var active = rows.filter(function (e) { return e.status === 'active'; });
  var byCat = {}; active.forEach(function (e) { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  var pg = paginate(q, 50);
  return { total: rows.length, amount: sum(active, function (e) { return e.amount; }), rows: pg.slice(rows).map(clean),
    byCategory: Object.keys(byCat).map(function (k) { return { category: k, total: byCat[k] }; }).sort(function (a, b) { return b.total - a.total; }) };
}
function expensesVoid(rq) {
  requirePerm(rq.user, 'expenses.manage');
  var reason = str(rq.body.reason, 200); if (reason.length < 3) throw bad('validation_error', 'Invalid input', [{ path: 'reason' }]);
  var e = T('Expenses').get(rq.params.id); if (!e) throw notFound();
  if (e.status === 'voided') throw conflict('already_voided');
  T('Expenses').update(e.id, { status: 'voided', void_reason: reason });
  if (e.shift_id) { var sh = T('CashierShifts').get(e.shift_id);
    if (sh && sh.status === 'open') T('CashMovements').insert({ id: newId('csh'), shift_id: e.shift_id, type: 'expense', amount: e.amount, reason: 'Void: ' + reason, ref_id: e.id, user_id: rq.user.id, user_name: rq.user.display_name, created_at: nowIso() }); }
  audit(rq.user, 'expense.void', 'Expenses', e.id, { reason: reason, amount: e.amount });
  return { ok: true };
}
