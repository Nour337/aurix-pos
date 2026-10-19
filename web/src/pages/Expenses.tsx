import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Plus } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, post } from '../lib/api';
import { dateOnly, money, todayYmd, toPiasters } from '../lib/format';
import { Badge, Button, Card, Checkbox, Confirm, ErrorBox, Field, IconButton, Input, Modal, MoneyInput, PageHeader, Pagination, Select, Table, useToast } from '../components/ui';
import { ExportButton, HBars, RangeFilter, rangeDates, type Range } from '../components/widgets';

export default function Expenses() {
  const { t, lang } = useI18n();
  const { can, settings } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [range, setRange] = useState<Range>({ preset: 'month' });
  const [category, setCategory] = useState(''); const [page, setPage] = useState(1);
  const { from, to } = rangeDates(range);
  const query = { from, to, category, page, pageSize: 50 };
  const r = useQuery({ queryKey: ['expenses', query], queryFn: () => get('/expenses', query) });
  const shift = useQuery({ queryKey: ['shift-current'], queryFn: () => get('/shifts/current'), enabled: can('shifts.own') });
  const cats: string[] = settings['expenses.categories'] || [];
  const methods: string[] = settings['pos.payment_methods'] || ['cash'];
  const [form, setForm] = useState<any | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [voiding, setVoiding] = useState<any | null>(null); const [voidReason, setVoidReason] = useState('');
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await post('/expenses', { ...form, amount: toPiasters(form.amount), from_drawer: form.payment_method === 'cash' && form.from_drawer });
      qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['shift-current'] }); setForm(null); toast('success', t('exp.saved'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const doVoid = async () => {
    setBusy(true);
    try { await post(`/expenses/${voiding.id}/void`, { reason: voidReason }); qc.invalidateQueries({ queryKey: ['expenses'] }); setVoiding(null); setVoidReason(''); }
    catch (e) { toast('error', String((e as any).message)); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title={t('exp.title')} subtitle={r.data ? `${t('common.total')}: ${money(r.data.amount, lang)}` : undefined}
        actions={<>{can('export.data') && <ExportButton entity="expenses" query={{ from, to, category }} />}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setForm({ category: cats[0], description: '', amount: '', expense_date: todayYmd(), payment_method: 'cash', reference: '', from_drawer: !!shift.data }); }}>{t('exp.new')}</Button></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
            <RangeFilter value={range} onChange={(x) => { setRange(x); setPage(1); }} presets={['today', 'week', 'month', 'year', 'custom']} />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44"><option value="">{t('common.category')}: {t('common.all')}</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
          </div>
          <Table rows={r.data?.rows} loading={r.isLoading} rowKey={(e: any) => e.id} cols={[
            { key: 'd', header: t('common.date'), cell: (e: any) => dateOnly(e.expense_date, lang) },
            { key: 'c', header: t('common.category'), cell: (e: any) => <Badge tone="gold">{e.category}</Badge> },
            { key: 'ds', header: t('common.description'), cell: (e: any) => <span className={e.status === 'voided' ? 'text-ink-400 line-through' : ''}>{e.description || '—'}</span> },
            { key: 'm', header: t('common.method'), cell: (e: any) => <span>{t(`pay.${e.payment_method}` as TKey)}{e.shift_id ? ' · 🗄' : ''}</span> },
            { key: 'a', header: t('common.amount'), align: 'end', cell: (e: any) => <b className={e.status === 'voided' ? 'text-ink-400 line-through' : 'tabular-nums'}>{money(e.amount, lang)}</b> },
            { key: 'u', header: t('common.user'), cell: (e: any) => <span className="text-xs">{e.user_name}</span> },
            { key: 's', header: '', align: 'end', cell: (e: any) => e.status === 'voided' ? <Badge>{t('exp.voided')}</Badge> : can('expenses.manage') && <IconButton label={t('exp.void')} onClick={() => setVoiding(e)}><Ban className="h-4 w-4" /></IconButton> },
          ]} />
          {r.data && <Pagination page={page} pageSize={50} total={r.data.total} onPage={setPage} />}
        </Card>
        <Card title={t('exp.byCategory')}>{r.data?.byCategory?.length ? <HBars rows={r.data.byCategory.map((c: any) => ({ label: c.category, value: c.total }))} format={(v) => money(v, lang)} /> : <p className="text-sm text-ink-400">{t('common.empty')}</p>}</Card>
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} title={t('exp.new')} footer={<><Button variant="ghost" onClick={() => setForm(null)}>{t('common.cancel')}</Button><Button loading={busy} disabled={!(toPiasters(form?.amount || '0') > 0)} onClick={save}>{t('common.save')}</Button></>}>
        {form && <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.category')}><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label={t('common.amount')} required><MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} autoFocus /></Field>
          <Field label={t('common.description')} className="sm:col-span-2"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} /></Field>
          <Field label={t('common.date')}><Input type="date" value={form.expense_date} max={todayYmd()} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></Field>
          <Field label={t('common.method')}><Select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{t(`pay.${m}` as TKey)}</option>)}</Select></Field>
          <Field label={t('common.reference')} hint={t('common.optional')} className="sm:col-span-2"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={80} /></Field>
          {form.payment_method === 'cash' && shift.data && <div className="sm:col-span-2"><Checkbox checked={form.from_drawer} onChange={(v) => setForm({ ...form, from_drawer: v })} label={t('exp.fromDrawer')} hint={shift.data.shift.shift_no} /></div>}
          {err ? <div className="sm:col-span-2"><ErrorBox error={err} /></div> : null}
        </div>}
      </Modal>
      <Confirm open={!!voiding} onClose={() => setVoiding(null)} title={t('exp.voidTitle')} danger loading={busy} onConfirm={() => voidReason.trim().length >= 3 && doVoid()}>
        <Field label={t('common.reason')} required className="mt-3"><Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} maxLength={200} autoFocus /></Field>
      </Confirm>
    </div>
  );
}
