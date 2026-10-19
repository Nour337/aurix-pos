import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, CircleDollarSign, Coins, PackageX, Receipt, ShoppingBag, TrendingUp, Undo2, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get } from '../lib/api';
import { dateOnly, money, num, pname, timeOnly } from '../lib/format';
import { Badge, Card, Empty, ErrorBox, Skeleton, Stat } from '../components/ui';
import { BarChart, HBars, RangeFilter, rangeDates, type Range } from '../components/widgets';

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const [range, setRange] = useState<Range>({ preset: 'today' });
  const q = useQuery({ queryKey: ['summary', range], queryFn: () => get('/reports/summary', range as any), refetchInterval: 30_000 });
  const monthly = useQuery({ queryKey: ['monthly'], queryFn: () => get('/reports/monthly') });
  const d = q.data;
  const m = (v: number) => money(v, lang);
  const dates = rangeDates(range);
  const salesLink = () => nav(`/sales?from=${dates.from}&to=${dates.to}`);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gold-600">{t('dash.greeting', { name: user!.display_name })}</p>
          <h1 className="font-display text-3xl font-semibold text-navy">{t('dash.title')}</h1>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>
      {q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : null}
      {!d ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat emphasis label={t('dash.net')} value={m(d.sales.net)} hint={t('dash.netHint')} icon={<CircleDollarSign className="h-4 w-4" />} onClick={salesLink} />
            <Stat label={t('dash.gross')} value={m(d.sales.gross)} hint={`${t('dash.discounts')}: ${m(d.sales.discounts)}`} icon={<TrendingUp className="h-4 w-4" />} onClick={salesLink} />
            <Stat label={t('dash.invoices')} value={num(d.sales.invoices, lang)} hint={`${t('dash.avgTicket')}: ${m(d.sales.avg_ticket)}`} icon={<Receipt className="h-4 w-4" />} onClick={salesLink} />
            <Stat label={t('dash.grossProfit')} tone="gold" value={m(d.profit.gross_profit)} hint={t('dash.margin', { pct: d.profit.margin_pct })} icon={<Coins className="h-4 w-4" />} onClick={() => nav('/reports')} />
            <Stat label={t('dash.refunds')} value={m(d.sales.refunds)} hint={`${num(d.sales.returns_count, lang)} ${t('nav.returns')}`} icon={<Undo2 className="h-4 w-4" />} onClick={() => nav(`/returns?from=${dates.from}&to=${dates.to}`)} />
            <Stat label={t('dash.netProfit')} tone={d.profit.net_profit < 0 ? 'red' : 'green'} value={m(d.profit.net_profit)} hint={`${t('dash.expenses')}: ${m(d.profit.expenses)}`} icon={<Wallet className="h-4 w-4" />} onClick={() => nav('/expenses')} />
            <Stat label={t('dash.lowStock')} tone="amber" value={num(d.inventory.low_count, lang)} hint={t('dash.openAlerts') + `: ${d.inventory.open_alerts}`} icon={<AlertTriangle className="h-4 w-4" />} onClick={() => nav('/products?stock=low')} />
            <Stat label={t('dash.outOfStock')} tone="red" value={num(d.inventory.out_count, lang)} hint={`${num(d.inventory.products, lang)} ${t('dash.products')} · ${num(d.inventory.units, lang)} ${t('common.units')}`} icon={<PackageX className="h-4 w-4" />} onClick={() => nav('/products?stock=out')} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2" title={t('dash.daily')} subtitle={`${dateOnly(d.range.from, lang)} – ${dateOnly(d.range.to, lang)}`}>
              {d.daily.length > 1 ? <BarChart data={d.daily.map((x: any) => ({ label: x.date, value: x.net, gross: x.gross }))} labelFmt={(l) => l.slice(5)} />
                : <div className="py-6 text-center"><div className="font-display text-5xl font-semibold text-navy">{m(d.sales.net)}</div><div className="mt-2 text-sm text-ink-400">{num(d.sales.units, lang)} {t('common.units')}</div></div>}
            </Card>
            <Card title={t('dash.byMethod')}>
              {d.by_method.length ? <HBars rows={d.by_method.sort((a: any, b: any) => b.net - a.net).map((x: any) => ({ label: t(`pay.${x.method}` as TKey), value: x.net, sub: `${x.count} ${t('dash.invoices')}${x.refunds ? ` · −${m(x.refunds)}` : ''}` }))} format={m} /> : <Empty title={t('dash.noSales')} />}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card title={t('dash.bestSellers')} padded={false} action={<button onClick={() => nav('/reports')} className="text-xs font-semibold text-royal-600">{t('dash.viewAll')}</button>}>
              {d.best_sellers.length ? <ul className="divide-y divide-ink-100">{d.best_sellers.slice(0, 6).map((p: any, i: number) => (
                <li key={p.product_id} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-soft" onClick={() => nav(`/products/${p.product_id}`)}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-gold-400 text-navy' : 'bg-ink-100 text-ink-500'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{pname(p, lang)}</div><div className="text-xs text-ink-400" dir="ltr">{p.sku}</div></div>
                  <div className="text-end"><div className="text-sm font-semibold tabular-nums">{num(p.units, lang)}</div><div className="text-xs text-ink-400">{m(p.revenue)}</div></div>
                </li>))}</ul> : <Empty title={t('dash.noSales')} />}
            </Card>
            <Card title={t('dash.recentSales')} padded={false} action={<button onClick={salesLink} className="text-xs font-semibold text-royal-600">{t('dash.viewAll')}</button>}>
              {d.recent_sales.length ? <ul className="divide-y divide-ink-100">{d.recent_sales.slice(0, 6).map((s: any) => (
                <li key={s.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-soft" onClick={() => nav(`/sales/${s.id}`)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-royal-50 text-royal-500"><ShoppingBag className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium" dir="ltr">{s.invoice_no}</div><div className="text-xs text-ink-400">{timeOnly(s.created_at, lang)} · {s.cashier_name}</div></div>
                  <div className="text-end"><div className="text-sm font-semibold tabular-nums">{m(s.total)}</div>{s.status !== 'completed' && <Badge tone="amber">{t(`sales.status.${s.status}` as TKey)}</Badge>}</div>
                </li>))}</ul> : <Empty title={t('dash.noSales')} />}
            </Card>
            <Card title={t('dash.byCashier')}>
              {d.by_cashier.length ? <HBars rows={d.by_cashier.map((c: any) => ({ label: c.name, value: c.gross, sub: `${c.invoices} ${t('dash.invoices')}` }))} format={m} /> : <Empty title={t('dash.noSales')} />}
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 text-sm">
                <div><div className="text-xs text-ink-400">{t('dash.stockValue')}</div><div className="font-semibold tabular-nums">{m(d.inventory.cost_value)}</div></div>
                <div><div className="text-xs text-ink-400">{t('dash.retailValue')}</div><div className="font-semibold tabular-nums">{m(d.inventory.retail_value)}</div></div>
                <div><div className="text-xs text-ink-400">{t('dash.unitsInStock')}</div><div className="flex items-center gap-1 font-semibold tabular-nums"><Boxes className="h-4 w-4 text-gold-500" />{num(d.inventory.units, lang)}</div></div>
                <div><div className="text-xs text-ink-400">{t('dash.cogs')}</div><div className="font-semibold tabular-nums">{m(d.profit.cogs)}</div></div>
              </div>
            </Card>
          </div>

          <Card className="mt-6" title={t('dash.monthly')}>
            {monthly.data ? <BarChart data={monthly.data.rows.map((r: any) => ({ label: r.month, value: r.net, profit: r.gross_profit }))} secondaryKey="profit" height={160}
              labelFmt={(l) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short' }).format(new Date(l + '-15'))} /> : <Skeleton className="h-40" />}
          </Card>
        </>
      )}
    </div>
  );
}
