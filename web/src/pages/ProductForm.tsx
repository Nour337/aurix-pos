import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, patch, post } from '../lib/api';
import { fromPiasters, money, pname, toPiasters } from '../lib/format';
import { Button, Card, ErrorBox, Field, Input, Loading, MoneyInput, PageHeader, Select, Textarea, useToast } from '../components/ui';

const empty = { sku: '', barcode: '', name_en: '', name_ar: '', category_id: '', brand: '', cost_price: '', sell_price: '', min_stock: '', supplier_id: '', image_url: '',
  variant_group: '', size: '', color: '', fragrance: '', expiry_date: '', notes: '', initial_qty: '0' };

export default function ProductForm() {
  const { id } = useParams();
  const editing = !!id;
  const { t, lang } = useI18n();
  const { settings } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<typeof empty>({ ...empty, min_stock: String(settings['inventory.default_min_stock'] ?? 2) });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/catalog/categories') });
  const sups = useQuery({ queryKey: ['suppliers'], queryFn: () => get('/catalog/suppliers') });
  const cur = useQuery({ queryKey: ['product', id], queryFn: () => get(`/products/${id}`), enabled: editing });

  useEffect(() => {
    const p = cur.data?.product;
    if (!p) return;
    setF({ sku: p.sku, barcode: p.barcode || '', name_en: p.name_en, name_ar: p.name_ar, category_id: p.category_id || '', brand: p.brand, cost_price: fromPiasters(p.cost_price),
      sell_price: fromPiasters(p.sell_price), min_stock: String(p.min_stock), supplier_id: p.supplier_id || '', image_url: p.image_url, variant_group: p.variant_group, size: p.size,
      color: p.color, fragrance: p.fragrance, expiry_date: p.expiry_date || '', notes: p.notes, initial_qty: '0' });
  }, [cur.data]);

  const up = (k: keyof typeof empty) => (e: { target: { value: string } } | string) => setF((x) => ({ ...x, [k]: typeof e === 'string' ? e : e.target.value }));
  const generate = async () => { const r = await get('/products/next-sku'); setF((x) => ({ ...x, sku: r.sku })); setErrs((e) => ({ ...e, sku: '' })); };
  const checkUnique = async (k: 'sku' | 'barcode') => {
    const v = f[k].trim(); if (!v) return setErrs((e) => ({ ...e, [k]: '' }));
    const r = await get('/products/check-unique', { [k]: v, exceptId: id });
    setErrs((e) => ({ ...e, [k]: r.ok ? '' : k === 'sku' ? t('products.skuTaken') : t('products.barcodeTaken') }));
  };
  const cost = toPiasters(f.cost_price || '0'); const price = toPiasters(f.sell_price || '0');
  const margin = price > 0 && cost >= 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ve: Record<string, string> = {};
    if (!f.name_en.trim()) ve.name_en = t('common.required');
    if (!(price >= 0) || f.sell_price === '') ve.sell_price = t('common.required');
    if (errs.sku) ve.sku = errs.sku; if (errs.barcode) ve.barcode = errs.barcode;
    setErrs(ve); if (Object.keys(ve).length) return;
    const body: any = {
      name_en: f.name_en.trim(), name_ar: f.name_ar.trim(), category_id: f.category_id || null, brand: f.brand.trim(), cost_price: cost || 0, sell_price: price,
      min_stock: parseInt(f.min_stock || '0', 10), supplier_id: f.supplier_id || null, image_url: f.image_url.trim(), variant_group: f.variant_group.trim(), size: f.size.trim(),
      color: f.color.trim(), fragrance: f.fragrance.trim(), expiry_date: f.expiry_date || null, notes: f.notes.trim(), barcode: f.barcode.trim() || null,
    };
    if (f.sku.trim()) body.sku = f.sku.trim();
    if (!editing) body.initial_qty = parseInt(f.initial_qty || '0', 10);
    setBusy(true); setErr(null);
    try {
      const r = editing ? await patch(`/products/${id}`, body) : await post('/products', body);
      qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['product', r.id] });
      toast('success', editing ? t('products.updated') : t('products.created'));
      nav(`/products/${r.id}`);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  if (editing && cur.isLoading) return <Loading />;
  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <PageHeader back={<button type="button" onClick={() => nav(-1)} className="mb-2 flex items-center gap-1 text-sm text-ink-500 hover:text-royal-600"><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t('common.back')}</button>}
        title={editing ? t('products.edit') : t('products.new')} subtitle={editing ? pname(cur.data?.product, lang) : undefined}
        actions={<><Button type="button" variant="ghost" onClick={() => nav(-1)}>{t('common.cancel')}</Button><Button type="submit" loading={busy}>{t('common.save')}</Button></>} />
      <div className="space-y-6">
        <Card title={t('products.basics')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('products.nameEn')} required error={errs.name_en}><Input value={f.name_en} onChange={up('name_en')} maxLength={160} autoFocus invalid={!!errs.name_en} /></Field>
            <Field label={t('products.nameAr')} hint={t('common.optional')}><Input value={f.name_ar} onChange={up('name_ar')} maxLength={160} dir="rtl" /></Field>
            <Field label={t('products.sku')} error={errs.sku} hint={!editing ? 'AUR-0001…' : undefined}>
              <div className="flex gap-2"><Input value={f.sku} onChange={up('sku')} onBlur={() => checkUnique('sku')} dir="ltr" className="font-mono" invalid={!!errs.sku} maxLength={40} />
                <Button type="button" variant="subtle" icon={<Sparkles className="h-4 w-4" />} onClick={generate}>{t('products.generate')}</Button></div>
            </Field>
            <Field label={t('products.barcode')} error={errs.barcode} hint={t('common.optional')}><Input value={f.barcode} onChange={up('barcode')} onBlur={() => checkUnique('barcode')} dir="ltr" className="font-mono" invalid={!!errs.barcode} maxLength={64} /></Field>
            <Field label={t('common.category')}>
              <Select value={f.category_id} onChange={up('category_id')}><option value="">{t('products.selectCategory')}</option>{(cats.data?.rows || []).filter((c: any) => c.active || c.id === f.category_id).map((c: any) => <option key={c.id} value={c.id}>{pname(c, lang)}</option>)}</Select>
            </Field>
            <Field label={t('products.brand')} hint={t('common.optional')}><Input value={f.brand} onChange={up('brand')} maxLength={80} /></Field>
          </div>
        </Card>
        <Card title={t('products.pricing')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('products.price')} required error={errs.sell_price}><MoneyInput value={f.sell_price} onChange={up('sell_price')} invalid={!!errs.sell_price} /></Field>
            <Field label={t('products.cost')}><MoneyInput value={f.cost_price} onChange={up('cost_price')} /></Field>
            <div className="rounded-xl bg-soft p-3"><div className="text-xs font-semibold uppercase text-ink-400">{t('products.margin')}</div>
              <div className="mt-1 text-xl font-semibold text-gold-600">{margin === null ? '—' : `${margin}%`}</div>
              {price > 0 && <div className="text-xs text-ink-400">{money(price - cost, lang)} / {t('common.units')}</div>}</div>
          </div>
        </Card>
        <Card title={t('products.stockSection')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {!editing && <Field label={t('products.initialQty')}><Input inputMode="numeric" value={f.initial_qty} onChange={(e) => setF({ ...f, initial_qty: e.target.value.replace(/\D/g, '') })} /></Field>}
            <Field label={t('products.minStock')}><Input inputMode="numeric" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value.replace(/\D/g, '') })} /></Field>
            <Field label={t('products.supplier')}>
              <Select value={f.supplier_id} onChange={up('supplier_id')}><option value="">{t('products.selectSupplier')}</option>{(sups.data?.rows || []).filter((s: any) => s.active || s.id === f.supplier_id).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            </Field>
          </div>
          <p className="mt-3 text-xs text-ink-400">{t('products.qtyHint')}</p>
        </Card>
        <Card title={t('products.variantSection')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('products.size')}><Input value={f.size} onChange={up('size')} maxLength={40} /></Field>
            <Field label={t('products.color')}><Input value={f.color} onChange={up('color')} maxLength={40} /></Field>
            <Field label={t('products.fragrance')}><Input value={f.fragrance} onChange={up('fragrance')} maxLength={60} /></Field>
            <Field label={t('products.variantGroup')} hint="e.g. ROSE-SPLASH"><Input value={f.variant_group} onChange={up('variant_group')} maxLength={80} dir="ltr" /></Field>
            <Field label={t('products.expiry')} hint={t('common.optional')}><Input type="date" value={f.expiry_date} onChange={up('expiry_date')} /></Field>
            <Field label={t('products.image')} hint="https://…"><Input value={f.image_url} onChange={up('image_url')} dir="ltr" maxLength={500} /></Field>
          </div>
          <Field label={t('common.notes')} className="mt-4"><Textarea value={f.notes} onChange={up('notes')} maxLength={1000} /></Field>
        </Card>
        {err ? <ErrorBox error={err} /> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => nav(-1)}>{t('common.cancel')}</Button><Button type="submit" size="lg" loading={busy}>{t('common.save')}</Button></div>
      </div>
    </form>
  );
}
