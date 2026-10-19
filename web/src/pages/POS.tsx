import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, CreditCard, Minus, Plus, Printer, ScanBarcode, ShoppingBag, Smartphone, Tag, Trash2, UserRound, Wallet, X, Zap } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { ApiError, get, newTxnId, post } from '../lib/api';
import { fromPiasters, money, pname, toPiasters } from '../lib/format';
import { Badge, Button, Card, cx, Empty, ErrorBox, Field, IconButton, Input, Modal, MoneyInput, SearchInput, Segmented, Spinner, useDebounced, useErrorMessage, useToast, Confirm } from '../components/ui';
import { ApprovalModal } from '../components/widgets';
import Receipt, { printWithPageSize, type SaleBundle } from '../components/Receipt';

interface Line { product: any; qty: number }
const METHOD_ICON: Record<string, any> = { cash: Banknote, card: CreditCard, instapay: Zap, vodafone_cash: Smartphone, other: Wallet };

function useCart(userId: string) {
  const key = `aurix.cart.${userId}`;
  const [lines, setLines] = useState<Line[]>(() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(lines)); } catch { /* ignore */ } }, [lines, key]);
  return [lines, setLines] as const;
}

function OpenShift({ onOpened }: { onOpened: () => void }) {
  const { t } = useI18n();
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const open = async () => {
    setBusy(true); setErr(null);
    try { await post('/shifts/open', { opening_cash: toPiasters(cash || '0') }); onOpened(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-[70vh] place-items-center p-6">
      <Card className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-50 text-gold-500"><Wallet className="h-7 w-7" /></div>
        <h2 className="font-display text-2xl font-semibold text-navy">{t('pos.noShift')}</h2>
        <div className="mt-6 space-y-4 text-start">
          <Field label={t('pos.openingCash')}><MoneyInput value={cash} onChange={setCash} placeholder="0" autoFocus /></Field>
          {err ? <ErrorBox error={err} /> : null}
          <Button size="lg" variant="gold" className="w-full" loading={busy} onClick={open}>{t('pos.openShift')}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function POS() {
  const { t, lang } = useI18n();
  const { user, settings, can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 180);
  const [cat, setCat] = useState('');
  const [lines, setLines] = useCart(user!.id);
  const [discount, setDiscount] = useState<{ mode: 'pct' | 'amt'; value: string } | null>(null);
  const [discOpen, setDiscOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [custOpen, setCustOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [done, setDone] = useState<SaleBundle | null>(null);
  const [mobileCart, setMobileCart] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const shift = useQuery({ queryKey: ['shift-current'], queryFn: () => get('/shifts/current') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/catalog/categories') });
  const products = useQuery({ queryKey: ['pos-products', dq, cat], queryFn: () => get('/products', { q: dq, category: cat, pageSize: 60, status: 'active' }), placeholderData: (p) => p });

  const subtotal = lines.reduce((s, l) => s + l.product.sell_price * l.qty, 0);
  const discountAmt = useMemo(() => {
    if (!discount) return 0;
    const v = parseFloat(discount.value || '0');
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.min(subtotal, discount.mode === 'pct' ? Math.round((subtotal * Math.min(v, 100)) / 100) : toPiasters(v));
  }, [discount, subtotal]);
  const total = subtotal - discountAmt;
  const units = lines.reduce((s, l) => s + l.qty, 0);

  const add = useCallback((p: any, n = 1) => {
    if (p.qty <= 0) { toast('error', `${pname(p, lang)} — ${t('pos.outOfStock')}`); return; }
    setLines((ls) => {
      const ex = ls.find((l) => l.product.id === p.id);
      const want = (ex?.qty || 0) + n;
      if (want > p.qty) { toast('warning', t('pos.maxStock', { n: p.qty })); return ls; }
      return ex ? ls.map((l) => (l.product.id === p.id ? { product: p, qty: want } : l)) : [...ls, { product: p, qty: n }];
    });
  }, [setLines, toast, t, lang]);
  const setQty = (id: string, qty: number) => setLines((ls) => ls.flatMap((l) => (l.product.id !== id ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, l.product.qty) }])));

  // keep cart prices/stock fresh with the latest product data
  useEffect(() => {
    const fresh = new Map<string, any>((products.data?.rows || []).map((p: any) => [p.id, p]));
    if (!fresh.size) return;
    setLines((ls) => { let changed = false; const out = ls.map((l) => { const f = fresh.get(l.product.id); if (f && (f.qty !== l.product.qty || f.sell_price !== l.product.sell_price)) { changed = true; return { ...l, product: f }; } return l; }); return changed ? out : ls; });
  }, [products.data, setLines]);

  const lookup = useCallback(async (code: string) => {
    const c = code.trim();
    if (!c) return;
    try { const p = await get(`/products/lookup/${encodeURIComponent(c)}`); add(p); setQ(''); }
    catch {
      const rows = products.data?.rows || [];
      if (rows.length === 1 && dq === q) { add(rows[0]); setQ(''); } else toast('error', t('pos.notFound', { code: c }));
    }
  }, [add, products.data, toast, t, dq, q]);

  // USB barcode scanners type fast and finish with Enter — capture them even when the search box is not focused
  useEffect(() => {
    let buf = ''; let last = 0;
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') || checkoutOpen || done) return;
      const now = Date.now();
      if (now - last > 60) buf = '';
      last = now;
      if (e.key === 'Enter') { if (buf.length >= 3) { lookup(buf); e.preventDefault(); } buf = ''; return; }
      if (e.key.length === 1) buf += e.key;
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lookup, checkoutOpen, done]);

  if (shift.isLoading) return <div className="grid h-[60vh] place-items-center"><Spinner /></div>;
  if (!shift.data) return <OpenShift onOpened={() => qc.invalidateQueries({ queryKey: ['shift-current'] })} />;

  const onDone = (bundle: SaleBundle & { alerts?: any[] }) => {
    setDone(bundle); setLines([]); setDiscount(null); setCustomer({ name: '', phone: '' }); setCheckoutOpen(false); setMobileCart(false);
    qc.invalidateQueries({ queryKey: ['pos-products'] }); qc.invalidateQueries({ queryKey: ['shift-current'] }); qc.invalidateQueries({ queryKey: ['alerts-summary'] });
    bundle.alerts?.forEach((a) => toast('warning', <span><b>{a.type === 'out_of_stock' ? t('alerts.out') : t('alerts.low')}</b> — {pname(a, lang)} · {t('alerts.remaining')}: {a.qty}</span>, 7000));
  };

  const cart = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-navy">{t('pos.cart')}</h2>
          <p className="text-xs text-ink-400">{t('pos.shift', { no: shift.data.shift.shift_no })} · {t('common.items', { n: units })}</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label={t('pos.customer')} onClick={() => setCustOpen(true)} className={customer.name || customer.phone ? 'text-gold-600' : ''}><UserRound className="h-5 w-5" /></IconButton>
          {lines.length > 0 && <IconButton label={t('pos.clear')} onClick={() => setClearOpen(true)}><Trash2 className="h-5 w-5" /></IconButton>}
          <IconButton label={t('common.close')} onClick={() => setMobileCart(false)} className="lg:hidden"><X className="h-5 w-5" /></IconButton>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {!lines.length && <Empty icon={<ScanBarcode className="h-7 w-7" />} title={t('pos.emptyCart')} />}
        {lines.map((l) => (
          <div key={l.product.id} className="rounded-xl bg-soft p-3 ring-1 ring-ink-200/50 animate-in">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{pname(l.product, lang)}</div>
                <div className="text-xs text-ink-400"><span dir="ltr">{l.product.sku}</span> · {money(l.product.sell_price, lang)}</div>
              </div>
              <button onClick={() => setQty(l.product.id, 0)} className="text-ink-300 hover:text-red-500" aria-label="remove"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5" dir="ltr">
                <button onClick={() => setQty(l.product.id, l.qty - 1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white ring-1 ring-ink-200 hover:ring-royal-300 active:scale-95"><Minus className="h-4 w-4" /></button>
                <input value={l.qty} inputMode="numeric" onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); if (n > l.product.qty) toast('warning', t('pos.maxStock', { n: l.product.qty })); setQty(l.product.id, n || 1); }}
                  className="h-9 w-12 rounded-lg border-0 bg-white text-center text-sm font-bold ring-1 ring-ink-200 focus:ring-2 focus:ring-royal-300" aria-label={t('common.qty')} />
                <button onClick={() => add(l.product)} disabled={l.qty >= l.product.qty} className="grid h-9 w-9 place-items-center rounded-lg bg-white ring-1 ring-ink-200 hover:ring-royal-300 active:scale-95 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              </div>
              <span className="text-sm font-bold tabular-nums text-ink">{money(l.product.sell_price * l.qty, lang)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-100 bg-white px-5 py-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-500"><span>{t('pos.subtotal')}</span><span className="tabular-nums">{money(subtotal, lang)}</span></div>
          <div className="flex items-center justify-between text-ink-500">
            <button onClick={() => setDiscOpen(true)} disabled={!lines.length} className="flex items-center gap-1.5 font-medium text-royal-600 hover:text-royal-700 disabled:opacity-40"><Tag className="h-3.5 w-3.5" />{t('pos.discount')}{discount && discount.mode === 'pct' ? ` (${discount.value}%)` : ''}</button>
            <span className={cx('tabular-nums', discountAmt > 0 && 'text-emerald-600')}>{discountAmt > 0 ? `− ${money(discountAmt, lang)}` : '—'}</span>
          </div>
          <div className="flex items-end justify-between pt-2">
            <span className="font-semibold text-ink">{t('pos.total')}</span>
            <span className="font-display text-4xl font-semibold tabular-nums text-navy">{money(total, lang)}</span>
          </div>
        </div>
        <Button size="xl" variant="gold" className="mt-4 w-full" disabled={!lines.length} onClick={() => setCheckoutOpen(true)}>{t('pos.pay')} · {money(total, lang)}</Button>
      </div>
    </div>
  );

  const rows: any[] = products.data?.rows || [];
  return (
    <div className="flex h-[calc(100dvh-4rem)]">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-ink-200/70 bg-white px-4 py-4 lg:px-6">
          <SearchInput inputRef={searchRef} value={q} onChange={setQ} autoFocus placeholder={t('pos.search')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(q); } }} />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {[{ id: '', name_en: t('pos.allCategories'), name_ar: t('pos.allCategories') }, ...(cats.data?.rows || []).filter((c: any) => c.active)].map((c: any) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cx('shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition', cat === c.id ? 'bg-navy text-white shadow-sm' : 'bg-soft text-ink-600 ring-1 ring-ink-200 hover:ring-gold-300')}>
                {pname(c, lang)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-28 lg:p-6 lg:pb-6">
          {products.error ? <ErrorBox error={products.error} onRetry={() => products.refetch()} /> : null}
          {!rows.length && !products.isLoading && <Empty title={t('common.noResults')} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {rows.map((p) => {
              const inCart = lines.find((l) => l.product.id === p.id)?.qty || 0;
              const out = p.qty <= 0; const low = !out && p.qty <= p.min_stock;
              return (
                <button key={p.id} onClick={() => add(p)} disabled={out}
                  className={cx('group relative flex flex-col overflow-hidden rounded-2xl bg-white text-start shadow-card ring-1 transition active:scale-[.98]', inCart ? 'ring-2 ring-gold-400' : 'ring-ink-200/60 hover:-translate-y-0.5 hover:shadow-lift', out && 'opacity-50')}>
                  <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-royal-50 to-gold-50">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> :
                      <div className="grid h-full place-items-center font-display text-3xl font-semibold text-royal-300/80">{pname(p, lang).slice(0, 2)}</div>}
                    {inCart > 0 && <span className="absolute end-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-gold-400 px-2 text-sm font-bold text-navy shadow">{inCart}</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{pname(p, lang)}</span>
                    <span className="mt-0.5 text-[11px] text-ink-400" dir="ltr">{p.sku}{p.fragrance ? ` · ${p.fragrance}` : p.size ? ` · ${p.size}` : ''}</span>
                    <div className="mt-auto pt-2">
                      <div className="whitespace-nowrap font-semibold tabular-nums text-royal-600">{money(p.sell_price, lang)}</div>
                      <div className={cx('mt-0.5 flex items-center gap-1 text-[11px] font-medium', out ? 'text-red-600' : low ? 'text-amber-600' : 'text-ink-400')}>
                        <span className={cx('h-1.5 w-1.5 rounded-full', out ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-emerald-500')} />
                        {out ? t('pos.outOfStock') : low ? t('pos.lowStock', { n: p.qty }) : t('pos.inStock', { n: p.qty })}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="hidden w-[360px] shrink-0 border-s border-ink-200/70 bg-white lg:block xl:w-[400px]">{cart}</aside>

      {/* tablet / phone: bottom bar + sheet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white p-3 shadow-lift lg:hidden no-print">
        <button onClick={() => setMobileCart(true)} className="flex w-full items-center justify-between rounded-xl bg-navy px-5 py-3.5 text-white">
          <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-gold-300" />{t('common.items', { n: units })}</span>
          <span className="font-semibold tabular-nums text-gold-300">{money(total, lang)}</span>
        </button>
      </div>
      {mobileCart && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-navy/40" onClick={() => setMobileCart(false)} /><div className="absolute inset-y-0 end-0 w-full max-w-md bg-white shadow-lift animate-in">{cart}</div></div>}

      <DiscountModal open={discOpen} onClose={() => setDiscOpen(false)} value={discount} subtotal={subtotal} onApply={(d) => { setDiscount(d); setDiscOpen(false); }} canDiscount={can('discount.apply')} maxPct={user!.max_discount_pct} />
      <Modal open={custOpen} onClose={() => setCustOpen(false)} title={t('pos.customer')} size="sm" footer={<Button onClick={() => setCustOpen(false)}>{t('common.save')}</Button>}>
        <div className="space-y-3">
          <Field label={t('pos.customerName')} hint={t('common.optional')}><Input value={customer.name} maxLength={80} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></Field>
          <Field label={t('pos.customerPhone')} hint={t('common.optional')}><Input value={customer.phone} inputMode="tel" maxLength={20} dir="ltr" onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/[^0-9+\-\s]/g, '') })} /></Field>
        </div>
      </Modal>
      <Confirm open={clearOpen} onClose={() => setClearOpen(false)} danger title={t('pos.clear')} message={t('pos.clearConfirm')} onConfirm={() => { setLines([]); setDiscount(null); setClearOpen(false); }} />
      {checkoutOpen && <CheckoutModal lines={lines} total={total} orderDiscount={discountAmt} customer={customer} methods={settings['pos.payment_methods'] || ['cash']} onClose={() => setCheckoutOpen(false)} onDone={onDone} />}
      {done && <SuccessModal bundle={done} onClose={() => { setDone(null); setTimeout(() => searchRef.current?.focus(), 50); }} />}
    </div>
  );
}

function DiscountModal({ open, onClose, value, onApply, subtotal, canDiscount, maxPct }: { open: boolean; onClose: () => void; value: { mode: 'pct' | 'amt'; value: string } | null; onApply: (d: { mode: 'pct' | 'amt'; value: string } | null) => void; subtotal: number; canDiscount: boolean; maxPct: number }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<'pct' | 'amt'>(value?.mode || 'pct');
  const [v, setV] = useState(value?.value || '');
  const amt = mode === 'pct' ? Math.round((subtotal * Math.min(parseFloat(v || '0'), 100)) / 100) : toPiasters(v || '0');
  const pct = subtotal ? (amt * 100) / subtotal : 0;
  return (
    <Modal open={open} onClose={onClose} title={t('pos.discount')} size="sm" footer={<>
      {value && <Button variant="ghost" onClick={() => onApply(null)}>{t('pos.removeDiscount')}</Button>}
      <Button onClick={() => onApply(v ? { mode, value: v } : null)} disabled={!!v && (!(amt > 0) || amt > subtotal)}>{t('pos.applyDiscount')}</Button></>}>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'pct', label: t('pos.discountPct') }, { value: 'amt', label: t('pos.discountAmt') }]} className="mb-4" />
      {mode === 'pct' ? <Field label="%"><Input inputMode="decimal" value={v} autoFocus onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        : <Field label={t('common.amount')}><MoneyInput value={v} onChange={setV} autoFocus /></Field>}
      {amt > 0 && <p className="mt-3 text-sm text-ink-500">− {money(amt, lang)} ({pct.toFixed(1)}%)</p>}
      {amt > 0 && (!canDiscount || pct > maxPct) && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">{t('err.manager_approval_required')}</p>}
    </Modal>
  );
}

function CheckoutModal({ lines, total, orderDiscount, customer, methods, onClose, onDone }: { lines: Line[]; total: number; orderDiscount: number; customer: { name: string; phone: string }; methods: string[]; onClose: () => void; onDone: (b: any) => void }) {
  const { t, lang } = useI18n();
  const { settings } = useAuth();
  const txnId = useRef(newTxnId()); // the SAME id is reused for retries → the server never charges twice
  const [split, setSplit] = useState(false);
  const [method, setMethod] = useState(methods[0] || 'cash');
  const [received, setReceived] = useState(fromPiasters(total));
  const [ref, setRef] = useState('');
  const [parts, setParts] = useState<{ method: string; amount: string; reference: string }[]>([{ method: methods[0] || 'cash', amount: fromPiasters(total), reference: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [approval, setApproval] = useState(false);
  const label = (k: string) => (k === 'other' ? settings['pos.other_method_label'] || t('pay.other') : t(`pay.${k}` as TKey));

  const payments = split
    ? parts.map((p) => ({ method: p.method, amount: toPiasters(p.amount || '0'), reference: p.reference })).filter((p) => p.amount > 0)
    : total === 0 ? [] : [{ method, amount: method === 'cash' ? toPiasters(received || '0') : total, reference: ref }];
  const paid = payments.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const cashIn = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const change = Math.max(0, paid - total);
  const valid = paid >= total && paid - cashIn <= total && change <= cashIn;

  const submit = async (managerApproval?: { username: string; password: string }) => {
    setBusy(true); setError(null);
    try {
      const res = await post('/sales/checkout', {
        client_txn_id: txnId.current, items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })), order_discount: orderDiscount,
        payments, customer_name: customer.name, customer_phone: customer.phone, manager_approval: managerApproval,
      });
      setApproval(false);
      onDone(res);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'manager_approval_required' || e.code === 'manager_approval_invalid')) { setApproval(true); if (e.code === 'manager_approval_invalid') setError(e); }
      else { setApproval(false); setError(e); }
    } finally { setBusy(false); }
  };
  const quick = [total, ...[5000, 10000, 20000, 50000].map((d) => Math.ceil(total / d) * d)].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4);

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={t('pos.checkout')} size="md"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
        <Button variant="gold" size="lg" loading={busy} disabled={!valid} onClick={() => submit()}>{busy ? t('pos.processing') : error instanceof ApiError && error.code === 'network' ? t('common.retry') : t('pos.confirmPayment')}</Button></>}>
      <div className="mb-5 rounded-2xl bg-navy p-5 text-center text-white">
        <div className="text-xs uppercase tracking-widest text-royal-200">{t('pos.total')}</div>
        <div className="font-display text-5xl font-semibold tabular-nums text-gold-300">{money(total, lang)}</div>
      </div>
      {total > 0 && <div className="mb-4 flex justify-end"><Segmented value={split ? 'split' : 'single'} onChange={(v) => setSplit(v === 'split')} options={[{ value: 'single', label: t('pos.paymentMethod') }, { value: 'split', label: t('pos.split') }]} /></div>}
      {total > 0 && !split && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {methods.map((m) => { const I = METHOD_ICON[m] || Wallet; return (
              <button key={m} onClick={() => setMethod(m)} className={cx('flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold ring-1 transition', method === m ? 'bg-royal-500 text-white ring-royal-500 shadow' : 'bg-white text-ink ring-ink-200 hover:ring-royal-300')}>
                <I className="h-5 w-5" />{label(m)}
              </button>); })}
          </div>
          {method === 'cash' ? (
            <div className="mt-4 space-y-3">
              <Field label={t('pos.received')}><MoneyInput value={received} onChange={setReceived} className="h-14 text-xl font-semibold" autoFocus /></Field>
              <div className="flex flex-wrap gap-2">{quick.map((v, i) => <Button key={v} size="sm" variant="outline" onClick={() => setReceived(fromPiasters(v))}>{i === 0 ? t('pos.exact') : money(v, lang)}</Button>)}</div>
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800"><span className="font-medium">{t('pos.change')}</span><span className="text-2xl font-bold tabular-nums">{money(change, lang)}</span></div>
            </div>
          ) : (
            <Field label={t('pos.paymentRef')} hint={t('pos.reference.hint')} className="mt-4"><Input value={ref} maxLength={80} onChange={(e) => setRef(e.target.value)} dir="ltr" /></Field>
          )}
        </>
      )}
      {total > 0 && split && (
        <div className="space-y-2">
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <select value={p.method} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))} className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm">
                {methods.map((m) => <option key={m} value={m}>{label(m)}</option>)}
              </select>
              <MoneyInput value={p.amount} onChange={(v) => setParts(parts.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
              <IconButton label="remove" disabled={parts.length === 1} onClick={() => setParts(parts.filter((_, j) => j !== i))}><X className="h-4 w-4" /></IconButton>
            </div>
          ))}
          <Button size="sm" variant="subtle" icon={<Plus className="h-4 w-4" />} disabled={parts.length >= 4} onClick={() => setParts([...parts, { method: methods.find((m) => !parts.some((p) => p.method === m)) || methods[0], amount: fromPiasters(Math.max(0, total - paid)), reference: '' }])}>{t('pos.addPayment')}</Button>
          <div className="flex justify-between rounded-xl bg-soft px-4 py-3 text-sm"><span>{paid < total ? t('pos.remaining') : t('pos.change')}</span><span className={cx('font-bold tabular-nums', paid < total ? 'text-red-600' : 'text-emerald-700')}>{money(Math.abs(total - paid), lang)}</span></div>
        </div>
      )}
      {!valid && paid > 0 && paid < total && !split && <p className="mt-3 text-sm text-red-600">{t('pos.notEnough')}</p>}
      {error ? <div className="mt-4"><ErrorBox error={error} />{error instanceof ApiError && error.code === 'network' && <p className="mt-2 text-xs text-ink-500">{t('pos.retryHint')}</p>}</div> : null}
      <ApprovalModal open={approval} loading={busy} onClose={() => setApproval(false)} onApprove={(a) => submit(a)} />
    </Modal>
  );
}

function SuccessModal({ bundle, onClose }: { bundle: SaleBundle; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { settings } = useAuth();
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Enter') onClose(); }; const id = setTimeout(() => window.addEventListener('keydown', h), 400); return () => { clearTimeout(id); window.removeEventListener('keydown', h); }; }, [onClose]);
  return (
    <>
      <Modal open onClose={onClose} title={t('pos.success')} size="sm" footer={<>
        <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printWithPageSize(settings['receipt.width'] || '80')}>{t('pos.printReceipt')}</Button>
        <Button variant="gold" onClick={onClose} autoFocus>{t('pos.newSale')}</Button></>}>
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 animate-pop"><CheckCircle2 className="h-9 w-9" /></div>
          <div className="text-sm text-ink-500">{t('pos.invoice', { no: '' })}<b dir="ltr" className="text-ink">{bundle.sale.invoice_no}</b></div>
          <div className="mt-2 font-display text-4xl font-semibold text-navy">{money(bundle.sale.total, lang)}</div>
          {bundle.sale.change_due > 0 && <div className="mt-3 inline-block rounded-xl bg-emerald-50 px-4 py-2 text-emerald-800">{t('pos.change')}: <b className="text-xl">{money(bundle.sale.change_due, lang)}</b></div>}
          <div className="mt-3 flex justify-center gap-1">{bundle.payments.map((p, i) => <Badge key={i} tone="blue">{t(`pay.${p.method}` as TKey)}</Badge>)}</div>
        </div>
      </Modal>
      <div className="print-area print-only"><Receipt data={bundle} /></div>
    </>
  );
}
