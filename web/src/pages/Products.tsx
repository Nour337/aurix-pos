import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { get } from '../lib/api';
import { cname, money, num, pname } from '../lib/format';
import { Button, Card, ErrorBox, PageHeader, Pagination, SearchInput, Segmented, Select, StockBadge, Table, useDebounced, type Col } from '../components/ui';
import { ExportButton } from '../components/widgets';

export default function Products() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounced(q);
  const stock = (sp.get('stock') as any) || 'all';
  const status = (sp.get('status') as any) || 'active';
  const category = sp.get('category') || '';
  const page = Number(sp.get('page') || 1);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }); };
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/catalog/categories') });
  const query = { q: dq, stock, status, category, page, pageSize: 50 };
  const r = useQuery({ queryKey: ['products', query], queryFn: () => get('/products', query), placeholderData: (p) => p });
  const showCost = can('products.view_cost');

  const cols: Col<any>[] = [
    { key: 'name', header: t('common.name'), cell: (p) => (
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-royal-50 to-gold-50 font-display text-sm font-semibold text-royal-400">
          {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : pname(p, lang).slice(0, 2)}
        </div>
        <div className="min-w-0"><div className="truncate font-medium text-ink">{pname(p, lang)}</div><div className="truncate text-xs text-ink-400">{[p.brand, p.size, p.color, p.fragrance].filter(Boolean).join(' · ') || (lang === 'ar' ? p.name_en : p.name_ar)}</div></div>
      </div>) },
    { key: 'sku', header: t('products.sku'), cell: (p) => <div dir="ltr" className="text-start"><div className="font-mono text-xs font-semibold">{p.sku}</div>{p.barcode && <div className="font-mono text-[11px] text-ink-400">{p.barcode}</div>}</div> },
    { key: 'cat', header: t('common.category'), cell: (p) => <span className="text-ink-600">{cname(p, lang) || t('products.noCategory')}</span> },
    { key: 'price', header: t('products.price'), align: 'end', cell: (p) => <span className="font-semibold tabular-nums">{money(p.sell_price, lang)}</span> },
    ...(showCost ? [{ key: 'cost', header: t('products.cost'), align: 'end' as const, cell: (p: any) => <span className="tabular-nums text-ink-500">{money(p.cost_price, lang)}</span> }] : []),
    { key: 'qty', header: t('products.qty'), align: 'end', cell: (p) => <span className="font-semibold tabular-nums">{num(p.qty, lang)}</span> },
    { key: 'stock', header: t('products.stockStatus'), cell: (p) => <div className="flex items-center gap-1.5"><StockBadge qty={p.qty} min={p.min_stock} />{p.status === 'archived' && <span className="text-xs text-ink-400">{t('common.archived')}</span>}</div> },
  ];

  return (
    <div>
      <PageHeader title={t('products.title')} subtitle={r.data ? `${num(r.data.total, lang)} ${t('dash.products')}` : undefined}
        actions={can('products.manage') && <>{can('export.data') && <ExportButton entity="products" query={{ q: dq, stock, status, category }} />}<Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/products/new')}>{t('products.new')}</Button></>} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={q} onChange={(v) => { setQ(v); set('q', v); }} placeholder={t('products.searchPh')} className="min-w-[260px] flex-1" autoFocus />
          <Select value={category} onChange={(e) => set('category', e.target.value)} className="w-48">
            <option value="">{t('common.category')}: {t('common.all')}</option>
            {(cats.data?.rows || []).map((c: any) => <option key={c.id} value={c.id}>{pname(c, lang)}</option>)}
          </Select>
          <Segmented value={stock} onChange={(v) => set('stock', v === 'all' ? '' : v)} options={[
            { value: 'all', label: t('common.all') }, { value: 'attention', label: t('products.filter.attention') }, { value: 'low', label: t('products.stock.low') }, { value: 'out', label: t('products.stock.out') }]} />
          {can('products.manage') && <Segmented value={status} onChange={(v) => set('status', v === 'active' ? '' : v)} options={[{ value: 'active', label: t('common.active') }, { value: 'archived', label: t('common.archived') }, { value: 'all', label: t('common.all') }]} />}
        </div>
        {r.error ? <div className="p-4"><ErrorBox error={r.error} onRetry={() => r.refetch()} /></div> : null}
        <Table cols={cols} rows={r.data?.rows} loading={r.isLoading} rowKey={(p) => p.id} onRowClick={(p) => nav(`/products/${p.id}`)} />
        {r.data && <Pagination page={page} pageSize={50} total={r.data.total} onPage={(p) => set('page', String(p))} />}
      </Card>
    </div>
  );
}
