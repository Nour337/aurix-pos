import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff, Check, PackagePlus } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, post } from '../lib/api';
import { dateTime, pname } from '../lib/format';
import { Badge, Button, Card, Empty, ErrorBox, PageHeader, Pagination, Segmented, Table, useToast, useErrorMessage } from '../components/ui';
import { ExportButton } from '../components/widgets';

export default function Alerts() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast(); const em = useErrorMessage();
  const [status, setStatus] = useState<'active' | 'resolved' | 'all'>('active');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['alerts', status, page], queryFn: () => get('/inventory/alerts', { status, page, pageSize: 50 }), refetchInterval: 20_000 });
  const review = async (id: string) => {
    try { await post(`/inventory/alerts/${id}/review`); qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['alerts-summary'] }); toast('success', t('alerts.reviewed')); }
    catch (e) { toast('error', em(e)); }
  };
  return (
    <div>
      <PageHeader title={t('alerts.title')} subtitle={t('alerts.reviewHint')} actions={can('export.data') && <ExportButton entity="alerts" />} />
      <Card padded={false}>
        <div className="border-b border-ink-100 p-4"><Segmented value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: 'active', label: t('alerts.active') }, { value: 'resolved', label: t('alerts.resolved') }, { value: 'all', label: t('common.all') }]} /></div>
        {q.error ? <div className="p-4"><ErrorBox error={q.error} /></div> : null}
        <Table rows={q.data?.rows} loading={q.isLoading} rowKey={(a: any) => a.id} empty={<Empty icon={<BellOff className="h-7 w-7" />} title={t('alerts.none')} />} cols={[
          { key: 'type', header: t('common.type'), cell: (a: any) => <Badge tone={a.type === 'out_of_stock' ? 'red' : 'amber'}>{a.type === 'out_of_stock' ? t('alerts.out') : t('alerts.low')}</Badge> },
          { key: 'p', header: t('common.name'), cell: (a: any) => <button className="text-start" onClick={() => nav(`/products/${a.product_id}`)}><div className="font-medium hover:text-royal-600">{pname(a, lang)}</div><div className="font-mono text-xs text-ink-400" dir="ltr">{a.sku}</div></button> },
          { key: 'r', header: t('alerts.remaining'), align: 'end', cell: (a: any) => <span className={`text-lg font-bold tabular-nums ${a.current_qty === 0 ? 'text-red-600' : 'text-amber-600'}`}>{a.current_qty}</span> },
          { key: 'th', header: t('alerts.threshold'), align: 'end', cell: (a: any) => a.min_stock },
          { key: 's30', header: t('alerts.sold30'), align: 'end', cell: (a: any) => a.soldLast30 },
          { key: 'sg', header: t('alerts.suggested'), align: 'end', cell: (a: any) => a.status === 'resolved' ? '—' : <span className="font-semibold text-gold-600">+{a.suggested}</span> },
          { key: 'since', header: t('alerts.since'), cell: (a: any) => <span className="text-xs text-ink-500">{dateTime(a.created_at, lang)}</span> },
          { key: 'st', header: t('common.status'), cell: (a: any) => <Badge tone={a.status === 'resolved' ? 'green' : a.status === 'reviewed' ? 'blue' : 'red'}>{t(`alerts.${a.status}` as TKey)}{a.reviewed_by_name ? ` · ${a.reviewed_by_name}` : ''}</Badge> },
          { key: 'act', header: '', align: 'end', cell: (a: any) => a.status !== 'resolved' && <div className="flex justify-end gap-1">
            {a.status === 'open' && <Button size="sm" variant="outline" icon={<Check className="h-3.5 w-3.5" />} onClick={() => review(a.id)}>{t('alerts.review')}</Button>}
            {can('purchases.manage') && <Button size="sm" variant="subtle" icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={() => nav(`/purchases/new?product=${a.product_id}`)}>{t('products.receive')}</Button>}</div> },
        ]} />
        {q.data && <Pagination page={page} pageSize={50} total={q.data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
