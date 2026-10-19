import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, CircleDollarSign, PackageX } from 'lucide-react';
import { useI18n } from '../i18n';
import { get } from '../lib/api';
import { dateOnly, money, num, pname } from '../lib/format';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, Table, Empty } from '../components/ui';
import { HBars } from '../components/widgets';

export default function Inventory() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['inventory-overview'], queryFn: () => get('/inventory/overview') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data; const tt = d.totals;
  return (
    <div>
      <PageHeader title={t('inv.title')} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat emphasis label={t('dash.unitsInStock')} value={num(tt.units, lang)} hint={`${num(tt.products, lang)} ${t('dash.products')}`} icon={<Boxes className="h-4 w-4" />} onClick={() => nav('/products')} />
        <Stat label={t('dash.stockValue')} value={money(tt.cost_value, lang)} hint={`${t('dash.retailValue')}: ${money(tt.retail_value, lang)}`} icon={<CircleDollarSign className="h-4 w-4" />} />
        <Stat label={t('dash.lowStock')} tone="amber" value={num(tt.low_count, lang)} icon={<AlertTriangle className="h-4 w-4" />} onClick={() => nav('/products?stock=low')} />
        <Stat label={t('dash.outOfStock')} tone="red" value={num(tt.out_count, lang)} icon={<PackageX className="h-4 w-4" />} onClick={() => nav('/products?stock=out')} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={t('inv.byCategory')}>
          {d.byCategory.length ? <HBars rows={d.byCategory.map((c: any) => ({ label: pname(c, lang) || t('products.noCategory'), value: c.retail_value, sub: `${num(c.units, lang)} ${t('common.units')} · ${t('products.cost')}: ${money(c.cost_value, lang)}` }))} format={(v) => money(v, lang)} /> : <Empty title={t('common.empty')} />}
        </Card>
        <Card title={t('inv.expiring')} padded={false}>
          <Table dense rows={d.expiring} rowKey={(p: any) => p.id} onRowClick={(p: any) => nav(`/products/${p.id}`)} empty={<Empty title={t('common.empty')} />} cols={[
            { key: 'n', header: t('common.name'), cell: (p: any) => <span>{pname(p, lang)} <span className="text-xs text-ink-400" dir="ltr">{p.sku}</span></span> },
            { key: 'q', header: t('common.qty'), align: 'end', cell: (p: any) => p.qty },
            { key: 'e', header: t('products.expiry'), cell: (p: any) => <Badge tone={p.expired ? 'red' : 'amber'}>{p.expired ? t('inv.expired') + ' · ' : ''}{dateOnly(p.expiry_date, lang)}</Badge> },
          ]} />
        </Card>
      </div>
      <Card className="mt-6" title={t('inv.slow')} padded={false}>
        <Table dense rows={d.slowMoving} rowKey={(p: any) => p.id} onRowClick={(p: any) => nav(`/products/${p.id}`)} empty={<Empty title={t('common.empty')} />} cols={[
          { key: 'n', header: t('common.name'), cell: (p: any) => pname(p, lang) },
          { key: 's', header: t('products.sku'), cell: (p: any) => <span className="font-mono text-xs" dir="ltr">{p.sku}</span> },
          { key: 'q', header: t('common.qty'), align: 'end', cell: (p: any) => p.qty },
          { key: 'l', header: t('inv.lastSold'), cell: (p: any) => (p.last_sold ? dateOnly(p.last_sold, lang) : t('inv.never')) },
        ]} />
      </Card>
    </div>
  );
}
