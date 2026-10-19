import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { Archive, ArrowLeft, Barcode, PackagePlus, Pencil, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, patch, post } from '../lib/api';
import { cname, dateOnly, dateTime, money, num, pname } from '../lib/format';
import { Badge, Button, Card, Confirm, ErrorBox, Field, Input, Loading, Modal, PageHeader, Stat, StockBadge, Table, useToast, cx } from '../components/ui';
import { printWithPageSize } from '../components/Receipt';

export function MoveBadge({ type }: { type: string }) {
  const { t } = useI18n();
  const tone = ({ sale: 'blue', return: 'green', cancellation: 'green', purchase: 'gold', adjustment: 'amber', count: 'amber', initial: 'gray' } as any)[type] || 'gray';
  return <Badge tone={tone}>{t(`moves.type.${type}` as TKey)}</Badge>;
}

export default function ProductDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['product', id], queryFn: () => get(`/products/${id}`) });
  const [adjust, setAdjust] = useState(false);
  const [label, setLabel] = useState(false);
  const [archive, setArchive] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { product: p, movements, stats, alerts, variants } = q.data;
  const manage = can('products.manage');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['product', id] }); qc.invalidateQueries({ queryKey: ['products'] }); };
  const toggleArchive = async () => {
    await patch(`/products/${id}`, { status: p.status === 'active' ? 'archived' : 'active' });
    toast('success', p.status === 'active' ? t('products.archivedMsg') : t('products.restoredMsg'));
    setArchive(false); refresh();
  };

  return (
    <div>
      <PageHeader back={<button onClick={() => nav('/products')} className="mb-2 flex items-center gap-1 text-sm text-ink-500 hover:text-royal-600"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('products.title')}</button>}
        title={<span className="flex flex-wrap items-center gap-3">{pname(p, lang)} <StockBadge qty={p.qty} min={p.min_stock} />{p.status === 'archived' && <Badge>{t('common.archived')}</Badge>}</span>}
        subtitle={<span dir="ltr" className="font-mono">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</span>}
        actions={manage && <>
          <Button variant="outline" icon={<Barcode className="h-4 w-4" />} onClick={() => setLabel(true)}>{t('products.label')}</Button>
          <Button variant="outline" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setAdjust(true)}>{t('products.adjust')}</Button>
          {can('purchases.manage') && <Button variant="outline" icon={<PackagePlus className="h-4 w-4" />} onClick={() => nav(`/purchases/new?product=${p.id}`)}>{t('products.receive')}</Button>}
          <Button variant="ghost" icon={p.status === 'active' ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} onClick={() => setArchive(true)}>{p.status === 'active' ? t('common.archive') : t('common.restore')}</Button>
          <Button icon={<Pencil className="h-4 w-4" />} onClick={() => nav(`/products/${p.id}/edit`)}>{t('common.edit')}</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat emphasis label={t('products.qty')} value={num(p.qty, lang)} hint={`${t('products.minStock')}: ${p.min_stock}`} />
        <Stat label={t('products.price')} value={money(p.sell_price, lang)} hint={p.cost_price !== undefined ? `${t('products.cost')}: ${money(p.cost_price, lang)}` : undefined} />
        {stats && <Stat label={t('products.unitsSold')} value={num(stats.units_sold, lang)} hint={`${t('products.revenue')}: ${money(stats.revenue, lang)}`} />}
        {stats && <Stat label={t('products.profit')} tone="gold" value={money(stats.revenue - stats.cogs, lang)} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={t('common.details')}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[[t('products.nameEn'), p.name_en], [t('products.nameAr'), p.name_ar], [t('common.category'), cname(p, lang)], [t('products.brand'), p.brand], [t('products.size'), p.size], [t('products.color'), p.color],
              [t('products.fragrance'), p.fragrance], [t('products.expiry'), p.expiry_date ? dateOnly(p.expiry_date, lang) : ''], [t('products.supplier'), p.supplier_name], [t('products.variantGroup'), p.variant_group],
              [t('products.createdAt'), dateTime(p.created_at, lang)], [t('products.updatedAt'), dateTime(p.updated_at, lang)]].filter(([, v]) => v !== undefined).map(([k, v], i) => (
              <div key={i}><dt className="text-xs text-ink-400">{k}</dt><dd className="font-medium text-ink">{v || '—'}</dd></div>))}
          </dl>
          {p.notes && <p className="mt-4 rounded-lg bg-soft p-3 text-sm text-ink-600">{p.notes}</p>}
          {variants?.length > 0 && <div className="mt-5"><div className="mb-2 text-xs font-semibold uppercase text-ink-400">{t('products.variants')}</div>
            {variants.map((v: any) => <button key={v.id} onClick={() => nav(`/products/${v.id}`)} className="flex w-full justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-soft"><span>{[v.size, v.color, v.fragrance].filter(Boolean).join(' · ') || v.sku}</span><span className="tabular-nums text-ink-500">{v.qty}</span></button>)}</div>}
        </Card>
        {movements && <Card className="lg:col-span-2" title={t('products.history')} padded={false}>
          <Table dense rows={movements} rowKey={(m: any) => m.id} cols={[
            { key: 'd', header: t('common.date'), cell: (m: any) => <span className="whitespace-nowrap text-xs text-ink-500">{dateTime(m.created_at, lang)}</span> },
            { key: 't', header: t('common.type'), cell: (m: any) => <MoveBadge type={m.type} /> },
            { key: 'c', header: t('moves.change'), align: 'end', cell: (m: any) => <span className={cx('font-semibold tabular-nums', m.qty_change > 0 ? 'text-emerald-600' : 'text-red-600')} dir="ltr">{m.qty_change > 0 ? '+' : ''}{m.qty_change}</span> },
            { key: 'a', header: `${t('moves.before')} → ${t('moves.after')}`, align: 'center', cell: (m: any) => <span className="tabular-nums text-ink-500" dir="ltr">{m.qty_before} → {m.qty_after}</span> },
            { key: 'r', header: t('common.reason'), cell: (m: any) => <span className="text-xs text-ink-600">{m.reason}</span> },
            { key: 'u', header: t('common.user'), cell: (m: any) => <span className="text-xs">{m.user_name}</span> },
          ]} />
        </Card>}
      </div>
      {alerts?.length > 0 && <Card className="mt-6" title={t('nav.alerts')} padded={false}><Table dense rows={alerts} rowKey={(a: any) => a.id} cols={[
        { key: 'd', header: t('common.date'), cell: (a: any) => dateTime(a.created_at, lang) },
        { key: 't', header: t('common.type'), cell: (a: any) => <Badge tone={a.type === 'out_of_stock' ? 'red' : 'amber'}>{a.type === 'out_of_stock' ? t('alerts.out') : t('alerts.low')}</Badge> },
        { key: 'q', header: t('alerts.remaining'), cell: (a: any) => a.qty_at_trigger },
        { key: 's', header: t('common.status'), cell: (a: any) => <Badge tone={a.status === 'resolved' ? 'green' : a.status === 'reviewed' ? 'blue' : 'red'}>{t(`alerts.${a.status}` as TKey)}</Badge> },
      ]} /></Card>}

      <AdjustModal open={adjust} onClose={() => setAdjust(false)} product={p} onDone={() => { setAdjust(false); refresh(); toast('success', t('products.adjusted')); }} />
      <LabelModal open={label} onClose={() => setLabel(false)} product={p} />
      <Confirm open={archive} onClose={() => setArchive(false)} onConfirm={toggleArchive} title={p.status === 'active' ? t('common.archive') : t('common.restore')} message={p.status === 'active' ? t('products.archiveConfirm') : undefined} danger={p.status === 'active'} />
    </div>
  );
}

function AdjustModal({ open, onClose, product, onDone }: { open: boolean; onClose: () => void; product: any; onDone: () => void }) {
  const { t } = useI18n();
  const [qty, setQty] = useState(String(product.qty)); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  useEffect(() => { if (open) { setQty(String(product.qty)); setReason(''); setErr(null); } }, [open, product.qty]);
  const n = parseInt(qty || '0', 10); const diff = n - product.qty;
  const save = async () => { setBusy(true); setErr(null); try { await post('/inventory/adjust', { productId: product.id, newQty: n, reason }); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  return (
    <Modal open={open} onClose={onClose} title={t('products.adjust')} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} disabled={diff === 0 || reason.trim().length < 3} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-soft p-3 text-sm"><span>{t('count.system')}</span><b className="tabular-nums">{product.qty}</b></div>
        <Field label={t('products.newQty')}><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} autoFocus /></Field>
        {diff !== 0 && <p className={cx('text-sm font-semibold', diff > 0 ? 'text-emerald-600' : 'text-red-600')} dir="ltr">{diff > 0 ? '+' : ''}{diff}</p>}
        <Field label={t('products.adjustReason')} required><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
        {err ? <ErrorBox error={err} /> : null}
      </div>
    </Modal>
  );
}

function LabelModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: any }) {
  const { t, lang } = useI18n();
  const [count, setCount] = useState('1');
  const ref = useRef<SVGSVGElement>(null);
  const [svg, setSvg] = useState('');
  const code = product.barcode || product.sku;
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => { if (ref.current) { try { JsBarcode(ref.current, code, { format: 'CODE128', height: 40, width: 1.6, fontSize: 12, margin: 0 }); setSvg(new XMLSerializer().serializeToString(ref.current)); } catch { /* invalid chars */ } } }, 0);
    return () => clearTimeout(id);
  }, [open, code]);
  const n = Math.min(100, Math.max(1, parseInt(count || '1', 10)));
  const labelEl = (k: number) => (
    <div key={k} style={{ width: '50mm', padding: '2mm', textAlign: 'center', pageBreakAfter: 'always', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em' }}>◆ AURIX</div>
      <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pname(product, lang)}</div>
      {svg && <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={code} style={{ width: '100%', height: 48 }} />}
      <div style={{ fontSize: 12, fontWeight: 700 }}>{money(product.sell_price, lang)}</div>
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} title={t('products.label')} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.close')}</Button><Button onClick={() => printWithPageSize('58')}>{t('common.print')}</Button></>}>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-soft p-4">
        <div className="text-xs font-semibold tracking-[0.2em] text-navy">◆ AURIX</div>
        <div className="text-sm font-medium">{pname(product, lang)}</div>
        <svg ref={ref} />
        <div className="font-semibold">{money(product.sell_price, lang)}</div>
      </div>
      <Field label={t('products.labels')} className="mt-4"><Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} /></Field>
      {open && <div className="print-area print-only">{Array.from({ length: n }).map((_, k) => labelEl(k))}</div>}
    </Modal>
  );
}
