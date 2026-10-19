import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { get } from '../lib/api';
import { dateOnly, money, num, pname } from '../lib/format';
import { Button, Card, ErrorBox, Loading, PageHeader, Table, cx } from '../components/ui';
import { BarChart, ExportButton, HBars, RangeFilter, rangeDates, type Range } from '../components/widgets';
import { printWithPageSize } from '../components/Receipt';

export default function Reports() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState<Range>({ preset: 'month' });
  const q = useQuery({ queryKey: ['summary', range], queryFn: () => get('/reports/summary', range as any) });
  const { from, to } = rangeDates(range);
  const m = (v: number) => money(v, lang);
  const d = q.data;
  const line = (label: string, v: number, opts: { neg?: boolean; strong?: boolean; gold?: boolean } = {}) => (
    <div className={cx('flex justify-between py-2', opts.strong && 'border-t border-ink-200 font-semibold text-ink', !opts.strong && 'text-ink-600')}>
      <span>{label}</span><span className={cx('tabular-nums', opts.gold && 'text-gold-600', opts.neg && v > 0 && 'text-red-600')}>{opts.neg && v ? '−' : ''}{m(Math.abs(v))}</span></div>
  );
  const productCols = [
    { key: 'n', header: t('common.name'), cell: (p: any) => <div><div className="font-medium">{pname(p, lang)}</div><div className="font-mono text-[11px] text-ink-400" dir="ltr">{p.sku}</div></div> },
    { key: 'u', header: t('reports.units'), align: 'end' as const, cell: (p: any) => num(p.units, lang) },
    { key: 'r', header: t('reports.revenue'), align: 'end' as const, cell: (p: any) => m(p.revenue) },
    { key: 'p', header: t('reports.profit'), align: 'end' as const, cell: (p: any) => <b className="text-gold-600">{m(p.profit)}</b> },
  ];
  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={d ? `${dateOnly(d.range.from, lang)} – ${dateOnly(d.range.to, lang)}` : undefined}
        actions={<><ExportButton entity="sale-items" query={{ from, to }} /><Button variant="outline" icon={<Printer className="h-4 w-4" />} onClick={() => printWithPageSize('A4')}>{t('common.print')}</Button></>} />
      <div className="mb-6 no-print"><RangeFilter value={range} onChange={setRange} presets={['today', 'week', 'month', 'last30', 'year', 'custom']} /></div>
      {q.error ? <ErrorBox error={q.error} /> : !d ? <Loading /> : (
        <div className="print-area">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title={t('reports.pl')}>
              <div className="text-sm">
                {line(t('reports.subtotalBefore'), d.sales.subtotal)}
                {line(t('reports.lessDiscounts'), d.sales.discounts, { neg: true })}
                {line(t('dash.gross'), d.sales.gross, { strong: true })}
                {line(t('reports.lessRefunds'), d.sales.refunds, { neg: true })}
                {line(t('dash.net'), d.sales.net, { strong: true })}
                {line(t('reports.lessCogs'), d.profit.cogs, { neg: true })}
                {line(t('dash.grossProfit') + ` (${d.profit.margin_pct}%)`, d.profit.gross_profit, { strong: true, gold: true })}
                {line(t('reports.lessExpenses'), d.profit.expenses, { neg: true })}
                <div className="mt-2 flex justify-between rounded-xl bg-navy px-4 py-3 font-semibold text-white"><span>{t('dash.netProfit')}</span><span className="tabular-nums text-gold-300">{m(d.profit.net_profit)}</span></div>
              </div>
              <p className="mt-4 text-xs text-ink-400">{t('reports.cogsNote')}</p>
            </Card>
            <Card className="lg:col-span-2" title={t('dash.daily')}>
              <BarChart data={d.daily.map((x: any) => ({ label: x.date, value: x.net }))} labelFmt={(l) => l.slice(5)} />
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div><div className="text-xs text-ink-400">{t('dash.invoices')}</div><div className="text-lg font-semibold">{num(d.sales.invoices, lang)}</div></div>
                <div><div className="text-xs text-ink-400">{t('dash.avgTicket')}</div><div className="text-lg font-semibold">{m(d.sales.avg_ticket)}</div></div>
                <div><div className="text-xs text-ink-400">{t('reports.units')}</div><div className="text-lg font-semibold">{num(d.sales.units, lang)}</div></div>
                <div><div className="text-xs text-ink-400">{t('dash.refunds')}</div><div className="text-lg font-semibold">{d.sales.returns_count}</div></div>
              </div>
            </Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title={t('dash.byMethod')}><HBars rows={d.by_method.map((x: any) => ({ label: t(`pay.${x.method}` as TKey), value: x.net, sub: x.refunds ? `${m(x.sales)} − ${m(x.refunds)}` : undefined }))} format={m} /></Card>
            <Card title={t('reports.byCategory')}><HBars rows={d.by_category.map((c: any) => ({ label: pname(c, lang) || t('products.noCategory'), value: c.revenue, sub: `${t('reports.profit')}: ${m(c.profit)}` }))} format={m} /></Card>
            <Card title={t('reports.expensesByCat')}><HBars rows={d.expenses_by_category.map((c: any) => ({ label: c.category, value: c.total }))} format={m} /></Card>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title={t('dash.bestSellers')} padded={false}><Table dense rows={d.best_sellers} rowKey={(p: any) => p.product_id} cols={productCols} /></Card>
            <Card title={t('reports.mostProfitable')} padded={false}><Table dense rows={d.most_profitable} rowKey={(p: any) => p.product_id} cols={productCols} /></Card>
          </div>
          <Card className="mt-6" title={t('dash.byCashier')} padded={false}><Table dense rows={d.by_cashier} rowKey={(c: any) => c.id} cols={[
            { key: 'n', header: t('sales.cashier'), cell: (c: any) => c.name },
            { key: 'i', header: t('dash.invoices'), align: 'end', cell: (c: any) => c.invoices },
            { key: 'g', header: t('dash.gross'), align: 'end', cell: (c: any) => <b>{m(c.gross)}</b> },
          ]} /></Card>
        </div>
      )}
    </div>
  );
}
