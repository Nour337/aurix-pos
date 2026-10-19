import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Undo2 } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { ApiError, get, newTxnId, post } from '../lib/api';
import { dateTime, money, pname } from '../lib/format';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, Input, PageHeader, Pagination, Select, Table, useToast } from '../components/ui';
import { ApprovalModal, ExportButton, RangeFilter, rangeDates, type Range } from '../components/widgets';

export default function Returns() {
  const { t, lang } = useI18n();
  const { can, settings } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [inv, setInv] = useState(sp.get('invoice') || '');
  const [sale, setSale] = useState<any | null>(null);
  const [lookupErr, setLookupErr] = useState<unknown>(null);
  const [lines, setLines] = useState<Record<string, { qty: string; restock: boolean }>>({});
  const [method, setMethod] = useState('cash'); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null); const [approval, setApproval] = useState(false);
  const txn = useRef(newTxnId());
  const [range, setRange] = useState<Range>(sp.get('from') ? { preset: 'custom', from: sp.get('from')!, to: sp.get('to')! } : { preset: 'month' });
  const [page, setPage] = useState(1);
  const { from, to } = rangeDates(range);
  const canList = can('returns.process') || can('reports.view');
  const list = useQuery({ queryKey: ['returns', from, to, page], queryFn: () => get('/returns', { from, to, page, pageSize: 50 }), enabled: canList });

  const lookup = async (no = inv) => {
    if (!no.trim()) return;
    setLookupErr(null); setSale(null); setErr(null);
    try {
      const r = await get(`/sales/by-invoice/${encodeURIComponent(no.trim())}`);
      setSale(r); setLines({}); txn.current = newTxnId();
      setMethod(r.payments.length === 1 ? r.payments[0].method : 'cash');
    } catch (e) { setLookupErr(e); }
  };
  useEffect(() => { if (sp.get('invoice')) lookup(sp.get('invoice')!); /* eslint-disable-next-line */ }, []);

  const selected = sale ? sale.items.filter((i: any) => parseInt(lines[i.id]?.qty || '0', 10) > 0) : [];
  const refund = selected.reduce((s: number, i: any) => {
    const q = parseInt(lines[i.id].qty, 10); const rem = i.qty - i.returned_qty;
    return s + (q === rem ? i.net_total - i.refunded_amount : Math.round((i.net_total * q) / i.qty));
  }, 0);

  const submit = async (manager_approval?: any) => {
    setBusy(true); setErr(null);
    try {
      const r = await post('/returns', { client_txn_id: txn.current, sale_id: sale.sale.id, refund_method: method, reason, manager_approval,
        items: selected.map((i: any) => ({ sale_item_id: i.id, qty: parseInt(lines[i.id].qty, 10), restock: lines[i.id].restock })) });
      setApproval(false);
      toast('success', t('returns.done', { no: r.return.return_no }));
      qc.invalidateQueries();
      setSale(null); setInv(''); setReason(''); setLines({});
    } catch (e) {
      if (e instanceof ApiError && e.code.startsWith('manager_approval')) { setApproval(true); if (e.code === 'manager_approval_invalid') setErr(e); }
      else { setApproval(false); setErr(e); }
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={t('returns.title')} actions={can('export.data') && <ExportButton entity="returns" query={{ from, to }} />} />
      <Card title={t('returns.new')}>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); lookup(); }}>
          <Input value={inv} onChange={(e) => setInv(e.target.value.toUpperCase())} placeholder={t('returns.invoicePh')} dir="ltr" className="max-w-sm font-mono" autoFocus />
          <Button type="submit" icon={<Search className="h-4 w-4" />}>{t('returns.lookup')}</Button>
        </form>
        {lookupErr ? <div className="mt-4"><ErrorBox error={lookupErr} /></div> : null}
        {sale && (
          <div className="mt-6 animate-in">
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <button className="font-mono font-semibold text-royal-600" dir="ltr" onClick={() => nav(`/sales/${sale.sale.id}`)}>{sale.sale.invoice_no}</button>
              <span className="text-ink-500">{dateTime(sale.sale.created_at, lang)} · {sale.sale.cashier_name}</span>
              <Badge tone="blue">{money(sale.sale.total, lang)}</Badge>
            </div>
            <Table dense rows={sale.items} rowKey={(i: any) => i.id} cols={[
              { key: 'n', header: t('common.name'), cell: (i: any) => <div><div className="font-medium">{pname(i, lang)}</div><div className="font-mono text-[11px] text-ink-400" dir="ltr">{i.sku}</div></div> },
              { key: 'p', header: t('sales.lineTotal'), align: 'end', cell: (i: any) => money(i.net_total, lang) },
              { key: 's', header: t('returns.sold'), align: 'end', cell: (i: any) => i.qty },
              { key: 'r', header: t('returns.alreadyReturned'), align: 'end', cell: (i: any) => i.returned_qty || '—' },
              { key: 'q', header: t('returns.returnQty'), align: 'end', cell: (i: any) => { const rem = i.qty - i.returned_qty; return rem <= 0 ? '—' :
                <Input inputMode="numeric" className="ms-auto h-9 w-20 text-end" value={lines[i.id]?.qty ?? ''} placeholder={`0–${rem}`} aria-label={t('returns.returnQty')}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); const n = Math.min(parseInt(v || '0', 10), rem); setLines({ ...lines, [i.id]: { qty: v ? String(n) : '', restock: lines[i.id]?.restock ?? true } }); }} />; } },
              { key: 'k', header: t('returns.restock'), cell: (i: any) => i.qty - i.returned_qty > 0 && <Checkbox checked={lines[i.id]?.restock ?? true} onChange={(v) => setLines({ ...lines, [i.id]: { qty: lines[i.id]?.qty || '', restock: v } })} label="" /> },
            ]} />
            <p className="mt-2 text-xs text-ink-400">{t('returns.restockHint')}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label={t('returns.refundMethod')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{(settings['pos.payment_methods'] || ['cash']).map((m: string) => <option key={m} value={m}>{t(`pay.${m}` as TKey)}</option>)}</Select></Field>
              <Field label={t('common.reason')} required className="sm:col-span-2"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('returns.reasonPh')} maxLength={300} /></Field>
            </div>
            {err ? <div className="mt-4"><ErrorBox error={err} /></div> : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-4">
              <span className="text-sm text-ink-500">{t('returns.refund')}: <b className="text-xl text-navy">{money(refund, lang)}</b></span>
              <Button variant="gold" size="lg" icon={<Undo2 className="h-4 w-4" />} loading={busy} disabled={!selected.length || reason.trim().length < 3}
                onClick={() => (can('returns.process') ? submit() : setApproval(true))}>{t('returns.submit')}</Button>
            </div>
          </div>
        )}
      </Card>

      {canList && <Card className="mt-6" padded={false} title={t('nav.returns')} action={<RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} presets={['today', 'week', 'month', 'custom']} />}>
        <Table rows={list.data?.rows} loading={list.isLoading} rowKey={(r: any) => r.id} onRowClick={(r: any) => nav(`/sales/${r.sale_id}`)} cols={[
          { key: 'n', header: t('returns.no'), cell: (r: any) => <span className="font-mono text-xs font-semibold" dir="ltr">{r.return_no}</span> },
          { key: 'k', header: t('common.type'), cell: (r: any) => <Badge tone={r.kind === 'cancellation' ? 'red' : 'amber'}>{t(`returns.kind.${r.kind}` as TKey)}</Badge> },
          { key: 'i', header: t('sales.invoice'), cell: (r: any) => <span className="font-mono text-xs" dir="ltr">{r.invoice_no}</span> },
          { key: 'd', header: t('common.date'), cell: (r: any) => dateTime(r.created_at, lang) },
          { key: 'u', header: t('common.qty'), align: 'end', cell: (r: any) => r.units },
          { key: 'a', header: t('returns.refund'), align: 'end', cell: (r: any) => <b className="tabular-nums">{money(r.refund_total, lang)}</b> },
          { key: 'm', header: t('common.method'), cell: (r: any) => t(`pay.${r.refund_method}` as TKey) },
          { key: 'r', header: t('common.reason'), cell: (r: any) => <span className="text-xs">{r.reason}</span> },
          { key: 'by', header: t('common.user'), cell: (r: any) => <span className="text-xs">{r.user_name}{r.approved_by_name && r.approved_by_name !== r.user_name ? ` ✓ ${r.approved_by_name}` : ''}</span> },
        ]} />
        {list.data && <Pagination page={page} pageSize={50} total={list.data.total} onPage={setPage} />}
      </Card>}
      <ApprovalModal open={approval} loading={busy} onClose={() => setApproval(false)} onApprove={submit} />
    </div>
  );
}
