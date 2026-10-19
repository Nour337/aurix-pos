import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { Badge, Card, PageHeader, Pagination, SearchInput, Select, Table, useDebounced } from '../components/ui';
import { ExportButton, RangeFilter, rangeDates, type Range } from '../components/widgets';

export const saleTone = (s: string) => (({ completed: 'green', partially_returned: 'amber', returned: 'gray', cancelled: 'red' } as any)[s] || 'gray');
export default function Sales() {
  const { t, lang } = useI18n();
  const { can, settings } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [range, setRange] = useState<Range>(sp.get('from') ? { preset: 'custom', from: sp.get('from')!, to: sp.get('to') || sp.get('from')! } : { preset: 'today' });
  const [q, setQ] = useState(''); const dq = useDebounced(q);
  const [method, setMethod] = useState(''); const [status, setStatus] = useState(''); const [cashier, setCashier] = useState(''); const [page, setPage] = useState(1);
  const { from, to } = rangeDates(range);
  const query = { from, to, q: dq, method, status, cashier, page, pageSize: 50 };
  const r = useQuery({ queryKey: ['sales', query], queryFn: () => get('/sales', query) });
  const users = useQuery({ queryKey: ['users-basic'], queryFn: () => get('/users/basic'), enabled: can('sales.view_all') && can('reports.view') });
  return (
    <div>
      <PageHeader title={t('sales.title')} subtitle={r.data ? `${r.data.total} ${t('dash.invoices')} · ${money(r.data.amount, lang)}` : undefined}
        actions={can('export.data') && <ExportButton entity="sales" query={{ from, to, q: dq, method, status, cashier }} />} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} />
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t('sales.searchPh')} className="min-w-[220px] flex-1" />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-40"><option value="">{t('sales.payment')}: {t('common.all')}</option>{(settings['pos.payment_methods'] || []).map((m: string) => <option key={m} value={m}>{t(`pay.${m}` as TKey)}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="">{t('common.status')}: {t('common.all')}</option>{['completed', 'partially_returned', 'returned', 'cancelled'].map((s) => <option key={s} value={s}>{t(`sales.status.${s}` as TKey)}</option>)}</Select>
          {users.data && <Select value={cashier} onChange={(e) => setCashier(e.target.value)} className="w-40"><option value="">{t('sales.cashier')}: {t('common.all')}</option>{users.data.rows.map((u: any) => <option key={u.id} value={u.id}>{u.display_name}</option>)}</Select>}
        </div>
        <Table rows={r.data?.rows} loading={r.isLoading} rowKey={(s: any) => s.id} onRowClick={(s: any) => nav(`/sales/${s.id}`)} cols={[
          { key: 'inv', header: t('sales.invoice'), cell: (s: any) => <span className="font-mono text-xs font-semibold" dir="ltr">{s.invoice_no}</span> },
          { key: 'd', header: t('common.date'), cell: (s: any) => <span className="whitespace-nowrap text-ink-500">{dateTime(s.created_at, lang)}</span> },
          { key: 'c', header: t('sales.cashier'), cell: (s: any) => s.cashier_name },
          { key: 'cu', header: t('pos.customer'), cell: (s: any) => s.customer_name || s.customer_phone || '—' },
          { key: 'u', header: t('sales.items'), align: 'end', cell: (s: any) => s.units },
          { key: 'p', header: t('sales.payment'), cell: (s: any) => <div className="flex flex-wrap gap-1">{s.payment_summary.split('+').filter((x: string) => x !== 'none').map((m: string) => <Badge key={m} tone="blue">{t(`pay.${m}` as TKey)}</Badge>)}</div> },
          { key: 't', header: t('common.total'), align: 'end', cell: (s: any) => <div><div className="font-semibold tabular-nums">{money(s.total, lang)}</div>{s.refunded > 0 && <div className="text-xs text-red-600">−{money(s.refunded, lang)}</div>}</div> },
          { key: 's', header: t('common.status'), cell: (s: any) => <Badge tone={saleTone(s.status)}>{t(`sales.status.${s.status}` as TKey)}</Badge> },
        ]} />
        {r.data && <Pagination page={page} pageSize={50} total={r.data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
