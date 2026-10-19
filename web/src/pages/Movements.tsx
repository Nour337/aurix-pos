import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useI18n, type TKey } from '../i18n';
import { get } from '../lib/api';
import { dateTime, pname } from '../lib/format';
import { Card, PageHeader, Pagination, SearchInput, Select, Table, cx, useDebounced } from '../components/ui';
import { ExportButton, RangeFilter, rangeDates, type Range } from '../components/widgets';
import { MoveBadge } from './ProductDetail';

const TYPES = ['sale', 'return', 'cancellation', 'purchase', 'adjustment', 'count', 'initial'];
export default function Movements() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [range, setRange] = useState<Range>({ preset: 'week' });
  const [type, setType] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
  const { from, to } = rangeDates(range);
  const query = { from, to, type, q: dq, page, pageSize: 100 };
  const r = useQuery({ queryKey: ['movements', query], queryFn: () => get('/inventory/movements', query) });
  return (
    <div>
      <PageHeader title={t('moves.title')} actions={<ExportButton entity="movements" query={{ from, to, type, q: dq }} />} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} presets={['today', 'week', 'month', 'year', 'custom']} />
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-44"><option value="">{t('common.type')}: {t('common.all')}</option>{TYPES.map((x) => <option key={x} value={x}>{t(`moves.type.${x}` as TKey)}</option>)}</Select>
          <SearchInput value={q} onChange={setQ} placeholder={t('products.searchPh')} className="min-w-[220px] flex-1" />
        </div>
        <Table dense rows={r.data?.rows} loading={r.isLoading} rowKey={(m: any) => m.id} onRowClick={(m: any) => nav(`/products/${m.product_id}`)} cols={[
          { key: 'd', header: t('common.date'), cell: (m: any) => <span className="whitespace-nowrap text-xs text-ink-500">{dateTime(m.created_at, lang)}</span> },
          { key: 'p', header: t('common.name'), cell: (m: any) => <div><div className="font-medium">{pname(m, lang)}</div><div className="font-mono text-[11px] text-ink-400" dir="ltr">{m.sku}</div></div> },
          { key: 't', header: t('common.type'), cell: (m: any) => <MoveBadge type={m.type} /> },
          { key: 'c', header: t('moves.change'), align: 'end', cell: (m: any) => <span dir="ltr" className={cx('font-semibold tabular-nums', m.qty_change > 0 ? 'text-emerald-600' : 'text-red-600')}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span> },
          { key: 'ba', header: `${t('moves.before')} → ${t('moves.after')}`, align: 'center', cell: (m: any) => <span dir="ltr" className="tabular-nums text-ink-500">{m.qty_before} → {m.qty_after}</span> },
          { key: 'r', header: t('common.reason'), cell: (m: any) => <span className="text-xs">{m.reason}</span> },
          { key: 'u', header: t('common.user'), cell: (m: any) => <span className="text-xs">{m.user_name}</span> },
        ]} />
        {r.data && <Pagination page={page} pageSize={100} total={r.data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
