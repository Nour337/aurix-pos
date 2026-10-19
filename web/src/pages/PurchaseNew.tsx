import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { get, newTxnId, post } from '../lib/api';
import { fromPiasters, money, pname, todayYmd, toPiasters } from '../lib/format';
import { Button, Card, Checkbox, Empty, ErrorBox, Field, IconButton, Input, MoneyInput, PageHeader, Select, Textarea, useToast } from '../components/ui';
import ProductPicker from '../components/ProductPicker';

export default function PurchaseNew() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp] = useSearchParams();
  const txn = useRef(newTxnId());
  const sups = useQuery({ queryKey: ['suppliers'], queryFn: () => get('/catalog/suppliers') });
  const [f, setF] = useState({ supplier_id: '', reference: '', purchase_date: todayYmd(), notes: '', update_cost: true });
  const [items, setItems] = useState<{ p: any; qty: string; cost: string }[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const add = (p: any) => setItems((x) => (x.some((i) => i.p.id === p.id) ? x : [...x, { p, qty: '1', cost: fromPiasters(p.cost_price ?? 0) }]));
  useEffect(() => { const id = sp.get('product'); if (id) get(`/products/${id}`).then((r) => add(r.product)).catch(() => {}); }, [sp]);
  const total = items.reduce((s, i) => s + (parseInt(i.qty || '0', 10) * toPiasters(i.cost || '0') || 0), 0);
  const valid = items.length > 0 && items.every((i) => parseInt(i.qty || '0', 10) > 0 && toPiasters(i.cost || '0') >= 0);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await post('/purchases', { client_txn_id: txn.current, ...f, supplier_id: f.supplier_id || null, items: items.map((i) => ({ product_id: i.p.id, qty: parseInt(i.qty, 10), unit_cost: toPiasters(i.cost || '0') })) });
      qc.invalidateQueries(); toast('success', `${t('purchases.saved')} · ${r.purchase_no || ''}`); nav('/purchases');
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back={<button onClick={() => nav(-1)} className="mb-2 flex items-center gap-1 text-sm text-ink-500 hover:text-royal-600"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('common.back')}</button>} title={t('purchases.new')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={t('purchases.items')}>
          <ProductPicker onPick={add} exclude={items.map((i) => i.p.id)} />
          <div className="mt-4 space-y-2">
            {!items.length && <Empty title={t('purchases.noItems')} />}
            {items.map((i, k) => (
              <div key={i.p.id} className="grid grid-cols-[1fr_90px_140px_auto] items-center gap-3 rounded-xl bg-soft p-3">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{pname(i.p, lang)}</div><div className="text-xs text-ink-400"><span dir="ltr">{i.p.sku}</span> · {i.p.qty} {t('common.units')}</div></div>
                <Input inputMode="numeric" value={i.qty} aria-label={t('common.qty')} onChange={(e) => setItems(items.map((x, j) => (j === k ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x)))} />
                <MoneyInput value={i.cost} aria-label={t('purchases.unitCost')} onChange={(v) => setItems(items.map((x, j) => (j === k ? { ...x, cost: v } : x)))} />
                <IconButton label="remove" onClick={() => setItems(items.filter((_, j) => j !== k))}><Trash2 className="h-4 w-4" /></IconButton>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end border-t border-ink-100 pt-4 text-lg"><span className="me-4 text-ink-500">{t('common.total')}</span><b className="tabular-nums">{money(total, lang)}</b></div>
        </Card>
        <Card title={t('common.details')}>
          <div className="space-y-4">
            <Field label={t('purchases.supplier')}><Select value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{(sups.data?.rows || []).filter((s: any) => s.active).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label={t('purchases.reference')}><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} maxLength={80} dir="ltr" /></Field>
            <Field label={t('purchases.date')}><Input type="date" value={f.purchase_date} max={todayYmd()} onChange={(e) => setF({ ...f, purchase_date: e.target.value })} /></Field>
            <Field label={t('common.notes')}><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} /></Field>
            <Checkbox checked={f.update_cost} onChange={(v) => setF({ ...f, update_cost: v })} label={t('purchases.updateCost')} />
            {err ? <ErrorBox error={err} /> : null}
            <Button size="lg" className="w-full" loading={busy} disabled={!valid} onClick={save}>{t('purchases.new')}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
