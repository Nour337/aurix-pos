import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Printer, Undo2 } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { ApiError, get, newTxnId, post } from '../lib/api';
import { dateTime, money, pname } from '../lib/format';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select, Table, useToast } from '../components/ui';
import { ApprovalModal } from '../components/widgets';
import Receipt, { printWithPageSize } from '../components/Receipt';
import { saleTone } from './Sales';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { can, settings } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['sale', id], queryFn: () => get(`/sales/${id}`) });
  const [reprint, setReprint] = useState(false);
  const [cancel, setCancel] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { sale: s, items, payments, returns } = q.data;
  const doPrint = async () => {
    try { await post(`/sales/${s.id}/reprint`); } catch { /* audit best-effort */ }
    setReprint(true); setTimeout(() => printWithPageSize(settings['receipt.width'] || '80'), 30);
  };
  const open = s.status === 'completed' || s.status === 'partially_returned';
  const showCost = s.cost_total !== undefined;
  return (
    <div>
      <PageHeader back={<button onClick={() => nav(-1)} className="mb-2 flex items-center gap-1 text-sm text-ink-500 hover:text-royal-600"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('sales.title')}</button>}
        title={<span className="flex flex-wrap items-center gap-3"><span dir="ltr">{s.invoice_no}</span><Badge tone={saleTone(s.status)}>{t(`sales.status.${s.status}` as TKey)}</Badge></span>}
        subtitle={`${dateTime(s.created_at, lang)} · ${s.cashier_name}${s.shift_no ? ` · ${s.shift_no}` : ''}`}
        actions={<>
          <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={doPrint}>{t('sales.reprint')}</Button>
          {open && <Button variant="outline" icon={<Undo2 className="h-4 w-4" />} onClick={() => nav(`/returns?invoice=${encodeURIComponent(s.invoice_no)}`)}>{t('sales.returnItems')}</Button>}
          {open && <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setCancel(true)}>{t('sales.cancel')}</Button>}</>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={t('sales.items')} padded={false}>
          <Table rows={items} rowKey={(i: any) => i.id} cols={[
            { key: 'n', header: t('common.name'), cell: (i: any) => <div><div className="font-medium">{pname(i, lang)}</div><div className="font-mono text-[11px] text-ink-400" dir="ltr">{i.sku}</div></div> },
            { key: 'q', header: t('common.qty'), align: 'end', cell: (i: any) => i.qty },
            { key: 'p', header: t('sales.unitPrice'), align: 'end', cell: (i: any) => money(i.unit_price, lang) },
            ...(showCost ? [{ key: 'c', header: t('sales.cost'), align: 'end' as const, cell: (i: any) => <span className="text-ink-500">{money(i.unit_cost, lang)}</span> }] : []),
            { key: 't', header: t('sales.lineTotal'), align: 'end', cell: (i: any) => <b className="tabular-nums">{money(i.net_total, lang)}</b> },
            { key: 'r', header: t('sales.returnedQty'), align: 'end', cell: (i: any) => (i.returned_qty ? <Badge tone="amber">{i.returned_qty}</Badge> : '—') },
          ]} />
        </Card>
        <Card title={t('common.total')}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">{t('pos.subtotal')}</dt><dd className="tabular-nums">{money(s.subtotal, lang)}</dd></div>
            {(s.line_discount + s.order_discount) > 0 && <div className="flex justify-between"><dt className="text-ink-500">{t('pos.discount')}</dt><dd className="tabular-nums text-emerald-600">−{money(s.line_discount + s.order_discount, lang)}</dd></div>}
            <div className="flex justify-between border-t border-ink-100 pt-2 text-lg font-semibold"><dt>{t('pos.total')}</dt><dd className="tabular-nums text-navy">{money(s.total, lang)}</dd></div>
            {payments.map((p: any, k: number) => <div key={k} className="flex justify-between"><dt className="text-ink-500">{t(`pay.${p.method}` as TKey)}{p.reference ? ` · ${p.reference}` : ''}</dt><dd className="tabular-nums">{money(p.amount, lang)}</dd></div>)}
            {s.change_due > 0 && <div className="flex justify-between"><dt className="text-ink-500">{t('pos.change')}</dt><dd className="tabular-nums">{money(s.change_due, lang)}</dd></div>}
            {showCost && <div className="flex justify-between border-t border-ink-100 pt-2"><dt className="text-ink-500">{t('sales.profit')}</dt><dd className="tabular-nums text-gold-600">{money(s.total - s.cost_total, lang)}</dd></div>}
            {s.discount_approved_by_name && <div className="text-xs text-ink-400">{t('sales.approvedBy')}: {s.discount_approved_by_name}</div>}
            {(s.customer_name || s.customer_phone) && <div className="border-t border-ink-100 pt-2 text-ink-600">{t('pos.customer')}: {s.customer_name} <span dir="ltr">{s.customer_phone}</span></div>}
          </dl>
        </Card>
      </div>
      {returns.length > 0 && <Card className="mt-6" title={t('sales.history')} padded={false}><Table dense rows={returns} rowKey={(r: any) => r.id} cols={[
        { key: 'n', header: t('returns.no'), cell: (r: any) => <span className="font-mono text-xs" dir="ltr">{r.return_no}</span> },
        { key: 'k', header: t('common.type'), cell: (r: any) => <Badge tone={r.kind === 'cancellation' ? 'red' : 'amber'}>{t(`returns.kind.${r.kind}` as TKey)}</Badge> },
        { key: 'd', header: t('common.date'), cell: (r: any) => dateTime(r.created_at, lang) },
        { key: 'a', header: t('returns.refund'), align: 'end', cell: (r: any) => money(r.refund_total, lang) },
        { key: 'm', header: t('common.method'), cell: (r: any) => t(`pay.${r.refund_method}` as TKey) },
        { key: 'r', header: t('common.reason'), cell: (r: any) => r.reason },
        { key: 'u', header: t('common.user'), cell: (r: any) => r.user_name },
      ]} /></Card>}
      <CancelModal open={cancel} onClose={() => setCancel(false)} sale={s} payments={payments} canCancel={can('sales.cancel')} onDone={() => { setCancel(false); qc.invalidateQueries(); toast('success', t('sales.cancelled')); }} />
      {reprint && <div className="print-area print-only"><Receipt data={q.data} reprint /></div>}
    </div>
  );
}

function CancelModal({ open, onClose, sale, payments, onDone, canCancel }: { open: boolean; onClose: () => void; sale: any; payments: any[]; onDone: () => void; canCancel: boolean }) {
  const { t } = useI18n();
  const { settings } = useAuth();
  const [txn] = useState(newTxnId());
  const [reason, setReason] = useState(''); const [method, setMethod] = useState(payments.length === 1 ? payments[0].method : 'cash');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null); const [approval, setApproval] = useState(false);
  const submit = async (manager_approval?: any) => {
    setBusy(true); setErr(null);
    try { await post(`/sales/${sale.id}/cancel`, { client_txn_id: txn, reason, refund_method: method, manager_approval }); setApproval(false); onDone(); }
    catch (e) { if (e instanceof ApiError && e.code.startsWith('manager_approval')) { setApproval(true); if (e.code === 'manager_approval_invalid') setErr(e); } else setErr(e); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('sales.cancelTitle')} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => (canCancel ? submit() : setApproval(true))}>{t('sales.cancel')}</Button></>}>
      <p className="mb-4 text-sm text-ink-500">{t('sales.cancelHint')}</p>
      <div className="space-y-3">
        <Field label={t('common.reason')} required><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus /></Field>
        <Field label={t('returns.refundMethod')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{(settings['pos.payment_methods'] || ['cash']).map((m: string) => <option key={m} value={m}>{t(`pay.${m}` as TKey)}</option>)}</Select></Field>
        {err ? <ErrorBox error={err} /> : null}
      </div>
      <ApprovalModal open={approval} loading={busy} onClose={() => setApproval(false)} onApprove={submit} />
    </Modal>
  );
}
