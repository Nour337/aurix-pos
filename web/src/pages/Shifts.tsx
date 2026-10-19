import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, Lock, Printer } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, post } from '../lib/api';
import { dateTime, money, toPiasters } from '../lib/format';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Modal, MoneyInput, PageHeader, Pagination, Segmented, Select, Table, cx, useToast } from '../components/ui';
import { ExportButton } from '../components/widgets';
import { printWithPageSize } from '../components/Receipt';

function DiffBadge({ v }: { v: number }) {
  const { t, lang } = useI18n();
  if (v === 0) return <Badge tone="green">{t('shift.balanced')}</Badge>;
  return <Badge tone={v > 0 ? 'amber' : 'red'}>{v > 0 ? t('shift.over') : t('shift.short')} {money(Math.abs(v), lang)}</Badge>;
}

export function ShiftSummary({ s, actions }: { s: any; actions?: React.ReactNode }) {
  const { t, lang } = useI18n();
  const m = (v: number) => money(v, lang);
  const sh = s.shift;
  const row = (k: string, v: number, strong?: boolean) => <div className={cx('flex justify-between py-1.5', strong && 'border-t border-ink-100 pt-3 text-base font-semibold')}><span className={strong ? '' : 'text-ink-500'}>{k}</span><span className="tabular-nums">{m(v)}</span></div>;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title={<span className="flex items-center gap-2">{sh.shift_no} <Badge tone={sh.status === 'open' ? 'green' : 'gray'}>{t(`shift.status.${sh.status}` as TKey)}</Badge></span>} subtitle={`${sh.user_name} · ${dateTime(sh.opened_at, lang)}${sh.closed_at ? ' → ' + dateTime(sh.closed_at, lang) : ''}`} action={actions}>
        <div className="text-sm">
          {row(t('shift.openingCash'), s.cash.opening)}{row(t('shift.cashSales'), s.cash.sales)}{row(t('shift.cashRefunds'), s.cash.refunds)}
          {row(t('shift.cashIn'), s.cash.cash_in)}{row(t('shift.cashOut'), s.cash.cash_out)}{row(t('shift.drawerExpenses'), s.cash.expenses)}
          {row(t('shift.expected'), s.expected_cash, true)}
          {sh.status === 'closed' && <>{row(t('shift.counted'), sh.counted_cash)}<div className="flex items-center justify-between py-1.5"><span className="text-ink-500">{t('shift.difference')}</span><DiffBadge v={sh.difference} /></div></>}
        </div>
      </Card>
      <Card title={t('shift.nonCash')}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">{t('shift.sales')}</span><b>{s.sales_count} · {m(s.sales_total)}</b></div>
          {s.payments_by_method.map((p: any) => <div key={p.method} className="flex justify-between"><span>{t(`pay.${p.method}` as TKey)}</span><span className="tabular-nums">{m(p.total)}</span></div>)}
          {s.refunds_by_method.map((p: any) => <div key={p.method} className="flex justify-between text-red-600"><span>{t('cash.refund')} · {t(`pay.${p.method}` as TKey)}</span><span className="tabular-nums">−{m(p.total)}</span></div>)}
        </div>
      </Card>
      <Card title={t('shift.movements')} padded={false}>
        <div className="max-h-80 overflow-y-auto">
          {s.movements.map((c: any) => <div key={c.id} className="flex items-center justify-between border-b border-ink-100 px-5 py-2 text-sm last:border-0">
            <div><div>{t(`cash.${c.type}` as TKey)}</div><div className="text-xs text-ink-400">{c.reason}</div></div>
            <span dir="ltr" className={cx('font-semibold tabular-nums', c.amount >= 0 ? 'text-emerald-600' : 'text-red-600')}>{c.amount >= 0 ? '+' : ''}{m(c.amount)}</span></div>)}
          {!s.movements.length && <p className="p-5 text-sm text-ink-400">{t('common.empty')}</p>}
        </div>
      </Card>
    </div>
  );
}

export default function Shifts() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const cur = useQuery({ queryKey: ['shift-current'], queryFn: () => get('/shifts/current'), enabled: can('shifts.own') });
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [user, setUser] = useState('');
  const list = useQuery({ queryKey: ['shifts', page, status, user], queryFn: () => get('/shifts', { page, status, user, pageSize: 30 }) });
  const users = useQuery({ queryKey: ['users-basic'], queryFn: () => get('/users/basic'), enabled: can('shifts.manage') });
  const [view, setView] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['shift', view], queryFn: () => get(`/shifts/${view}`), enabled: !!view });
  const [cash, setCash] = useState<{ type: 'cash_in' | 'cash_out'; amount: string; reason: string } | null>(null);
  const [closing, setClosing] = useState<{ counted: string; notes: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); qc.invalidateQueries({ queryKey: ['shift'] }); };
  const run = async (f: () => Promise<any>, ok: () => void) => { setBusy(true); setErr(null); try { await f(); ok(); refresh(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const s = cur.data;
  const closeTarget = view && detail.data?.shift.status === 'open' ? detail.data : s;

  return (
    <div>
      <PageHeader title={t('shift.title')} actions={can('export.data') && <ExportButton entity="shifts" query={{ cashier: user }} />} />
      {can('shifts.own') && (cur.isLoading ? <Loading /> : s ? (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">{t('shift.my')}</h2>
          <ShiftSummary s={s} actions={<div className="flex gap-1">
            <Button size="sm" variant="outline" icon={<ArrowDownCircle className="h-4 w-4" />} onClick={() => { setErr(null); setCash({ type: 'cash_in', amount: '', reason: '' }); }}>{t('shift.addCash')}</Button>
            <Button size="sm" variant="danger" icon={<Lock className="h-4 w-4" />} onClick={() => { setErr(null); setView(null); setClosing({ counted: '', notes: '' }); }}>{t('shift.close')}</Button></div>} />
        </div>
      ) : (
        <Card className="mb-8"><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-ink-500">{t('shift.noOpen')}</p><Button variant="gold" onClick={() => { setErr(null); setOpening(''); }}>{t('shift.open')}</Button></div></Card>
      ))}
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <Segmented value={status || 'all'} onChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }} options={[{ value: 'all', label: t('common.all') }, { value: 'open', label: t('shift.status.open') }, { value: 'closed', label: t('shift.status.closed') }]} />
          {users.data && <Select value={user} onChange={(e) => setUser(e.target.value)} className="w-44"><option value="">{t('sales.cashier')}: {t('common.all')}</option>{users.data.rows.map((u: any) => <option key={u.id} value={u.id}>{u.display_name}</option>)}</Select>}
        </div>
        <Table rows={list.data?.rows} loading={list.isLoading} rowKey={(x: any) => x.id} onRowClick={(x: any) => setView(x.id)} cols={[
          { key: 'n', header: t('shift.number'), cell: (x: any) => <span className="font-mono text-xs font-semibold" dir="ltr">{x.shift_no}</span> },
          { key: 'u', header: t('sales.cashier'), cell: (x: any) => x.user_name },
          { key: 'o', header: t('shift.opened'), cell: (x: any) => <span className="text-xs">{dateTime(x.opened_at, lang)}</span> },
          { key: 'c', header: t('shift.closed'), cell: (x: any) => <span className="text-xs">{x.closed_at ? dateTime(x.closed_at, lang) : '—'}</span> },
          { key: 's', header: t('shift.sales'), align: 'end', cell: (x: any) => `${x.sales_count} · ${money(x.sales_total, lang)}` },
          { key: 'e', header: t('shift.expected'), align: 'end', cell: (x: any) => money(x.expected_cash, lang) },
          { key: 'd', header: t('shift.difference'), cell: (x: any) => (x.status === 'closed' ? <DiffBadge v={x.difference} /> : <Badge tone="green">{t('shift.status.open')}</Badge>) },
        ]} />
        {list.data && <Pagination page={page} pageSize={30} total={list.data.total} onPage={setPage} />}
      </Card>

      <Modal open={!!view} onClose={() => setView(null)} title={t('shift.summary')} size="xl" footer={<>
        {detail.data?.shift.status === 'open' && can('shifts.manage') && <Button variant="danger" onClick={() => { setErr(null); setClosing({ counted: '', notes: '' }); }}>{t('shift.close')}</Button>}
        <Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printWithPageSize('80')}>{t('shift.print')}</Button></>}>
        {detail.data ? <><ShiftSummary s={detail.data} /><div className="print-area print-only"><ZReport s={detail.data} /></div></> : <Loading />}
      </Modal>
      <Modal open={opening !== null} onClose={() => setOpening(null)} title={t('shift.open')} size="sm" footer={<Button variant="gold" loading={busy} onClick={() => run(() => post('/shifts/open', { opening_cash: toPiasters(opening || '0') }), () => setOpening(null))}>{t('shift.open')}</Button>}>
        <Field label={t('pos.openingCash')}><MoneyInput value={opening || ''} onChange={setOpening} autoFocus /></Field>{err ? <div className="mt-3"><ErrorBox error={err} /></div> : null}
      </Modal>
      <Modal open={!!cash} onClose={() => setCash(null)} title={t('shift.addCash')} size="sm" footer={<Button loading={busy} disabled={!cash || !(toPiasters(cash.amount || '0') > 0) || cash.reason.trim().length < 3}
        onClick={() => run(() => post(`/shifts/${s.shift.id}/cash`, { type: cash!.type, amount: toPiasters(cash!.amount), reason: cash!.reason }), () => { setCash(null); toast('success', t('common.saved')); })}>{t('common.save')}</Button>}>
        {cash && <div className="space-y-4">
          <Segmented value={cash.type} onChange={(v) => setCash({ ...cash, type: v })} options={[{ value: 'cash_in', label: <span className="flex items-center gap-1"><ArrowDownCircle className="h-3.5 w-3.5" />{t('shift.cashIn')}</span> }, { value: 'cash_out', label: <span className="flex items-center gap-1"><ArrowUpCircle className="h-3.5 w-3.5" />{t('shift.cashOut')}</span> }]} />
          <Field label={t('common.amount')}><MoneyInput value={cash.amount} onChange={(v) => setCash({ ...cash, amount: v })} autoFocus /></Field>
          <Field label={t('common.reason')} required><Input value={cash.reason} onChange={(e) => setCash({ ...cash, reason: e.target.value })} maxLength={200} /></Field>
          {err ? <ErrorBox error={err} /> : null}
        </div>}
      </Modal>
      <Modal open={!!closing && !!closeTarget} onClose={() => setClosing(null)} title={t('shift.close')} size="sm" footer={<Button variant="danger" loading={busy} disabled={!closing || closing.counted === ''}
        onClick={() => run(() => post(`/shifts/${closeTarget.shift.id}/close`, { counted_cash: toPiasters(closing!.counted), notes: closing!.notes }), () => { setClosing(null); toast('success', t('common.saved')); })}>{t('shift.close')}</Button>}>
        {closing && closeTarget && <div className="space-y-4">
          <p className="text-sm text-ink-500">{t('shift.closeHint')}</p>
          <div className="flex justify-between rounded-xl bg-soft p-3 text-sm"><span>{t('shift.expected')}</span><b className="tabular-nums">{money(closeTarget.expected_cash, lang)}</b></div>
          <Field label={t('shift.counted')}><MoneyInput value={closing.counted} onChange={(v) => setClosing({ ...closing, counted: v })} autoFocus /></Field>
          {closing.counted !== '' && <div className="flex justify-between text-sm"><span>{t('shift.difference')}</span><DiffBadge v={toPiasters(closing.counted) - closeTarget.expected_cash} /></div>}
          <Field label={t('common.notes')}><Input value={closing.notes} onChange={(e) => setClosing({ ...closing, notes: e.target.value })} maxLength={300} /></Field>
          {err ? <ErrorBox error={err} /> : null}
        </div>}
      </Modal>
    </div>
  );
}

function ZReport({ s }: { s: any }) {
  const { t, lang, dir } = useI18n();
  const m = (v: number) => money(v, lang);
  const sh = s.shift;
  const R = ({ l, v }: { l: string; v: string }) => <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><span>{v}</span></div>;
  return (
    <div className="receipt receipt-80" dir={dir}>
      <div style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '.3em' }} dir="ltr">◆ AURIX</div>
      <div style={{ textAlign: 'center', fontWeight: 700 }}>Z — {sh.shift_no}</div><hr />
      <R l={t('sales.cashier')} v={sh.user_name} /><R l={t('shift.opened')} v={dateTime(sh.opened_at, lang)} />{sh.closed_at && <R l={t('shift.closed')} v={dateTime(sh.closed_at, lang)} />}<hr />
      <R l={t('shift.openingCash')} v={m(s.cash.opening)} /><R l={t('shift.cashSales')} v={m(s.cash.sales)} /><R l={t('shift.cashRefunds')} v={m(s.cash.refunds)} />
      <R l={t('shift.cashIn')} v={m(s.cash.cash_in)} /><R l={t('shift.cashOut')} v={m(s.cash.cash_out)} /><R l={t('shift.drawerExpenses')} v={m(s.cash.expenses)} /><hr />
      <R l={t('shift.expected')} v={m(s.expected_cash)} />{sh.status === 'closed' && <><R l={t('shift.counted')} v={m(sh.counted_cash)} /><R l={t('shift.difference')} v={m(sh.difference)} /></>}<hr />
      <R l={t('shift.sales')} v={`${s.sales_count} · ${m(s.sales_total)}`} />
      {s.payments_by_method.map((p: any) => <R key={p.method} l={t(`pay.${p.method}` as TKey)} v={m(p.total)} />)}
    </div>
  );
}
