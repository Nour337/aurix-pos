import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, DatabaseBackup, Download, ShieldCheck, XCircle } from 'lucide-react';
import { PAYMENT_METHODS } from '@shared/permissions';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, patch, post } from '../lib/api';
import { Button, Card, Checkbox, ErrorBox, Field, Input, PageHeader, Segmented, Spinner, useToast } from '../components/ui';
import Receipt from '../components/Receipt';

const sample = { sale: { invoice_no: 'INV-20261019-0001', created_at: new Date().toISOString(), cashier_name: 'Sara', subtotal: 40000, line_discount: 0, order_discount: 2000, total: 38000, change_due: 2000, customer_name: '' },
  items: [{ id: '1', name_en: 'Rose Body Splash', name_ar: 'بودي سبلاش الورد', sku: 'AUR-0001', qty: 2, unit_price: 15000, line_total: 30000, line_discount: 0 }, { id: '2', name_en: 'Pearl Hair Clip', name_ar: 'مشبك شعر لؤلؤ', sku: 'AUR-0002', qty: 1, unit_price: 10000, line_total: 10000, line_discount: 0 }],
  payments: [{ method: 'cash', amount: 38000 }] };

export default function SettingsPage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['settings-full'], queryFn: () => get('/settings') });
  const backups = useQuery({ queryKey: ['backups'], queryFn: () => get('/admin/backups') });
  const [s, setS] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [check, setCheck] = useState<any>(null); const [checking, setChecking] = useState(false);
  useEffect(() => { if (q.data) setS({ ...q.data, 'expenses.categories': (q.data['expenses.categories'] || []).join(', ') }); }, [q.data]);
  if (!s) return <div className="py-10 text-center"><Spinner /></div>;
  const up = (k: string) => (e: any) => setS({ ...s, [k]: e?.target ? e.target.value : e });
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body: any = {};
      ['store.name', 'store.tagline_en', 'store.tagline_ar', 'store.phone', 'store.address_en', 'store.address_ar', 'store.instagram', 'receipt.footer_en', 'receipt.footer_ar', 'receipt.policy_en', 'receipt.policy_ar', 'receipt.width', 'pos.other_method_label']
        .forEach((k) => (body[k] = String(s[k] ?? '')));
      body['pos.payment_methods'] = s['pos.payment_methods'];
      body['inventory.default_min_stock'] = Number(s['inventory.default_min_stock']);
      body['inventory.reorder_days'] = Number(s['inventory.reorder_days']);
      body['returns.max_days'] = Number(s['returns.max_days']);
      body['expenses.categories'] = String(s['expenses.categories']).split(',').map((x: string) => x.trim()).filter(Boolean);
      await patch('/settings', body);
      await refresh(); qc.invalidateQueries({ queryKey: ['settings-full'] }); toast('success', t('common.saved'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const backup = async () => { try { await post('/admin/backups'); backups.refetch(); toast('success', t('settings.backupDone')); } catch (e) { setErr(e); } };
  const runCheck = async () => { setChecking(true); try { setCheck(await get('/admin/integrity')); } finally { setChecking(false); } };
  const methods: string[] = s['pos.payment_methods'] || [];
  return (
    <div>
      <PageHeader title={t('settings.title')} actions={<Button loading={busy} onClick={save}>{t('common.save')}</Button>} />
      {err ? <div className="mb-4"><ErrorBox error={err} /></div> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title={t('settings.store')}><div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.storeName')}><Input value={s['store.name']} onChange={up('store.name')} maxLength={60} /></Field>
            <Field label={t('common.phone')}><Input dir="ltr" value={s['store.phone']} onChange={up('store.phone')} maxLength={40} /></Field>
            <Field label={t('settings.taglineEn')}><Input value={s['store.tagline_en']} onChange={up('store.tagline_en')} /></Field>
            <Field label={t('settings.taglineAr')}><Input dir="rtl" value={s['store.tagline_ar']} onChange={up('store.tagline_ar')} /></Field>
            <Field label={t('settings.addressEn')}><Input value={s['store.address_en']} onChange={up('store.address_en')} /></Field>
            <Field label={t('settings.addressAr')}><Input dir="rtl" value={s['store.address_ar']} onChange={up('store.address_ar')} /></Field>
            <Field label={t('settings.instagram')}><Input dir="ltr" value={s['store.instagram']} onChange={up('store.instagram')} placeholder="@aurix.eg" /></Field>
          </div></Card>
          <Card title={t('settings.receipt')}><div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settings.footerEn')}><Input value={s['receipt.footer_en']} onChange={up('receipt.footer_en')} /></Field>
            <Field label={t('settings.footerAr')}><Input dir="rtl" value={s['receipt.footer_ar']} onChange={up('receipt.footer_ar')} /></Field>
            <Field label={t('settings.policyEn')}><Input value={s['receipt.policy_en']} onChange={up('receipt.policy_en')} /></Field>
            <Field label={t('settings.policyAr')}><Input dir="rtl" value={s['receipt.policy_ar']} onChange={up('receipt.policy_ar')} /></Field>
            <Field label={t('settings.paperWidth')}><Segmented value={s['receipt.width']} onChange={up('receipt.width')} options={[{ value: '80', label: '80 mm' }, { value: '58', label: '58 mm' }]} /></Field>
          </div></Card>
          <Card title={t('settings.payments')}>
            <div className="grid gap-1 sm:grid-cols-3">{PAYMENT_METHODS.map((m) => <Checkbox key={m} checked={methods.includes(m)} label={t(`pay.${m}` as TKey)}
              onChange={(v) => setS({ ...s, 'pos.payment_methods': v ? [...methods, m] : methods.filter((x) => x !== m) })} />)}</div>
            <Field label={t('settings.otherLabel')} className="mt-4 max-w-xs"><Input value={s['pos.other_method_label']} onChange={up('pos.other_method_label')} maxLength={30} /></Field>
          </Card>
          <Card title={t('settings.inventory')}><div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('settings.defaultMin')}><Input inputMode="numeric" value={s['inventory.default_min_stock']} onChange={up('inventory.default_min_stock')} /></Field>
            <Field label={t('settings.reorderDays')}><Input inputMode="numeric" value={s['inventory.reorder_days']} onChange={up('inventory.reorder_days')} /></Field>
            <Field label={t('settings.returnDays')}><Input inputMode="numeric" value={s['returns.max_days']} onChange={up('returns.max_days')} /></Field>
            <Field label={t('settings.expenseCats')} className="sm:col-span-3"><Input value={s['expenses.categories']} onChange={up('expenses.categories')} /></Field>
          </div></Card>
          <Card title={t('settings.backup')} action={<Button size="sm" variant="subtle" icon={<DatabaseBackup className="h-4 w-4" />} onClick={backup}>{t('settings.backupNow')}</Button>}>
            <p className="mb-3 text-sm text-ink-500">{t('settings.backupHint')}</p>
            <ul className="max-h-56 divide-y divide-ink-100 overflow-y-auto text-sm">{(backups.data?.rows || []).map((b: any) => <li key={b.name} className="flex items-center justify-between py-2">
              <span className="text-xs" dir="ltr">{b.name}</span><a className="flex items-center gap-1 text-xs font-semibold text-royal-600" href={b.url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />{t('settings.download')}</a></li>)}</ul>
          </Card>
          <Card title={t('settings.integrity')} action={<Button size="sm" variant="subtle" icon={<ShieldCheck className="h-4 w-4" />} loading={checking} onClick={runCheck}>{t('settings.runCheck')}</Button>}>
            {!check ? <p className="text-sm text-ink-400">—</p> : <>
              <p className={`mb-3 text-sm font-semibold ${check.ok ? 'text-emerald-700' : 'text-red-700'}`}>{check.ok ? t('settings.integrityOk') : t('settings.integrityBad', { n: check.checks.filter((c: any) => c.count).length })}</p>
              <ul className="space-y-1.5 text-sm">{check.checks.map((c: any) => <li key={c.key} className="flex items-start gap-2">{c.count ? <XCircle className="mt-0.5 h-4 w-4 text-red-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />}
                <span>{t(`check.${c.key}` as TKey)}{c.count ? <code className="ms-2 text-xs text-red-600" dir="ltr">{c.count}: {c.rows.slice(0, 3).map((r: any) => r.sku || r.invoice_no || r.return_no || r.entity_id).join(', ')}</code> : null}</span></li>)}</ul>
              {Array.isArray(check.sheets) && <table className="mt-4 w-full text-xs"><thead><tr className="text-ink-400"><th className="text-start">{t('sync.tab')}</th><th className="text-end">{t('sync.dbRows')}</th><th className="text-end">{t('sync.sheetRows')}</th></tr></thead>
                <tbody>{check.sheets.map((r: any) => <tr key={r.tab} className={r.db !== r.sheet ? 'text-amber-700' : ''}><td>{r.tab}</td><td className="text-end">{r.db}</td><td className="text-end">{r.sheet}</td></tr>)}</tbody></table>}
            </>}
          </Card>
        </div>
        <div><div className="sticky top-4"><Card title={t('settings.preview')}><div className="flex justify-center overflow-x-auto rounded-xl bg-ink-100 p-4"><div className="shadow-card"><Receipt data={sample} width={s['receipt.width']} /></div></div></Card></div></div>
      </div>
    </div>
  );
}
