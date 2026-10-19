import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { get } from '../lib/api';
import { dateOnly, money, pname } from '../lib/format';
import { Button, Card, Modal, PageHeader, Pagination, SearchInput, Select, Table, useDebounced, Loading } from '../components/ui';
import { ExportButton, RangeFilter, rangeDates, type Range } from '../components/widgets';

export default function Purchases() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [range, setRange] = useState<Range>({ preset: 'month' });
  const [supplier, setSupplier] = useState(''); const [q, setQ] = useState(''); const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { from, to } = rangeDates(range);
  const query = { from, to, supplier, q: dq, page, pageSize: 50 };
  const r = useQuery({ queryKey: ['purchases', query], queryFn: () => get('/purchases', query) });
  const sups = useQuery({ queryKey: ['suppliers'], queryFn: () => get('/catalog/suppliers') });
  const detail = useQuery({ queryKey: ['purchase', open], queryFn: () => get(`/purchases/${open}`), enabled: !!open });
  return (
    <div>
      <PageHeader title={t('purchases.title')} subtitle={r.data ? `${t('common.total')}: ${money(r.data.amount, lang)}` : undefined}
        actions={<><ExportButton entity="purchases" query={{ from, to, supplier }} /><Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/purchases/new')}>{t('purchases.new')}</Button></>} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} presets={['today', 'week', 'month', 'year', 'custom']} />
          <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-48"><option value="">{t('purchases.supplier')}: {t('common.all')}</option>{(sups.data?.rows || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <SearchInput value={q} onChange={setQ} placeholder={`${t('purchases.no')} / ${t('common.reference')}`} className="w-64" />
        </div>
        <Table rows={r.data?.rows} loading={r.isLoading} rowKey={(p: any) => p.id} onRowClick={(p: any) => setOpen(p.id)} cols={[
          { key: 'no', header: t('purchases.no'), cell: (p: any) => <span className="font-mono text-xs font-semibold" dir="ltr">{p.purchase_no}</span> },
          { key: 'd', header: t('common.date'), cell: (p: any) => dateOnly(p.purchase_date, lang) },
          { key: 's', header: t('purchases.supplier'), cell: (p: any) => p.supplier_name || '—' },
          { key: 'r', header: t('common.reference'), cell: (p: any) => <span dir="ltr">{p.reference || '—'}</span> },
          { key: 'i', header: t('purchases.items'), align: 'end', cell: (p: any) => `${p.item_count} / ${p.units} ${t('common.units')}` },
          { key: 't', header: t('common.total'), align: 'end', cell: (p: any) => <span className="font-semibold tabular-nums">{money(p.total, lang)}</span> },
          { key: 'u', header: t('common.user'), cell: (p: any) => p.created_by_name },
        ]} />
        {r.data && <Pagination page={page} pageSize={50} total={r.data.total} onPage={setPage} />}
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={detail.data?.purchase.purchase_no || ''} size="lg">
        {!detail.data ? <Loading /> : <>
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-ink-400">{t('common.date')}</div>{dateOnly(detail.data.purchase.purchase_date, lang)}</div>
            <div><div className="text-xs text-ink-400">{t('purchases.supplier')}</div>{detail.data.purchase.supplier_name || '—'}</div>
            <div><div className="text-xs text-ink-400">{t('common.reference')}</div>{detail.data.purchase.reference || '—'}</div>
            <div><div className="text-xs text-ink-400">{t('common.total')}</div><b>{money(detail.data.purchase.total, lang)}</b></div>
          </div>
          <Table dense rows={detail.data.items} rowKey={(i: any) => i.id} cols={[
            { key: 'n', header: t('common.name'), cell: (i: any) => <span>{pname(i, lang)} <span className="text-xs text-ink-400" dir="ltr">{i.sku}</span></span> },
            { key: 'q', header: t('common.qty'), align: 'end', cell: (i: any) => i.qty },
            { key: 'c', header: t('purchases.unitCost'), align: 'end', cell: (i: any) => money(i.unit_cost, lang) },
            { key: 't', header: t('purchases.lineTotal'), align: 'end', cell: (i: any) => <b>{money(i.line_total, lang)}</b> },
          ]} />
          {detail.data.purchase.notes && <p className="mt-4 text-sm text-ink-500">{detail.data.purchase.notes}</p>}
        </>}
      </Modal>
    </div>
  );
}
