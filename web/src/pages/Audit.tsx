import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { get } from '../lib/api';
import { dateTime } from '../lib/format';
import { Badge, Card, PageHeader, Pagination, SearchInput, Select, Table, useDebounced } from '../components/ui';
import { ExportButton, RangeFilter, rangeDates, type Range } from '../components/widgets';

const ACTIONS = ['auth', 'sale', 'return', 'product', 'stock', 'purchase', 'expense', 'shift', 'user', 'settings', 'sync', 'alert', 'export', 'backup', 'receipt'];
export default function Audit() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<Range>({ preset: 'week' });
  const [action, setAction] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const { from, to } = rangeDates(range);
  const query = { from, to, action, q: dq, page, pageSize: 100 };
  const r = useQuery({ queryKey: ['audit', query], queryFn: () => get('/admin/audit', query) });
  return (
    <div>
      <PageHeader title={t('audit.title')} actions={<ExportButton entity="audit" query={{ from, to }} />} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} presets={['today', 'week', 'month', 'custom']} />
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-40"><option value="">{t('audit.action')}: {t('common.all')}</option>{ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</Select>
          <SearchInput value={q} onChange={setQ} placeholder={t('common.search')} className="min-w-[200px] flex-1" />
        </div>
        <Table dense rows={r.data?.rows} loading={r.isLoading} rowKey={(a: any) => a.id} cols={[
          { key: 'd', header: t('common.date'), cell: (a: any) => <span className="whitespace-nowrap text-xs">{dateTime(a.created_at, lang)}</span> },
          { key: 'u', header: t('common.user'), cell: (a: any) => a.username || '—' },
          { key: 'a', header: t('audit.action'), cell: (a: any) => <Badge tone={a.action.includes('failed') ? 'red' : a.action.startsWith('sale') || a.action.startsWith('return') ? 'blue' : 'gray'}>{a.action}</Badge> },
          { key: 'e', header: t('audit.entity'), cell: (a: any) => <span className="font-mono text-[11px] text-ink-500" dir="ltr">{a.entity}{a.entity_id ? ` · ${a.entity_id}` : ''}</span> },
          { key: 'x', header: t('audit.details'), cell: (a: any) => <code className="line-clamp-2 max-w-md break-all text-[11px] text-ink-500" dir="ltr">{a.details}</code> },
          { key: 'ip', header: t('audit.ip'), cell: (a: any) => <span className="text-[11px] text-ink-400" dir="ltr">{a.ip}</span> },
        ]} />
        {r.data && <Pagination page={page} pageSize={100} total={r.data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
