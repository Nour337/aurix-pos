import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { get, patch, post } from '../lib/api';
import { money } from '../lib/format';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, Input, Modal, PageHeader, Table, Textarea, useToast } from '../components/ui';

export default function Suppliers() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['suppliers'], queryFn: () => get('/catalog/suppliers') });
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = { name: edit.name.trim(), phone: edit.phone.trim(), email: edit.email.trim(), notes: edit.notes.trim(), active: edit.active };
      if (edit.id) await patch(`/catalog/suppliers/${edit.id}`, body); else await post('/catalog/suppliers', body);
      qc.invalidateQueries({ queryKey: ['suppliers'] }); setEdit(null); toast('success', t('common.saved'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title={t('suppliers.title')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit({ name: '', phone: '', email: '', notes: '', active: true }); }}>{t('suppliers.new')}</Button>} />
      <Card padded={false}>
        {q.error ? <ErrorBox error={q.error} /> : null}
        <Table rows={q.data?.rows} loading={q.isLoading} rowKey={(s: any) => s.id} onRowClick={(s: any) => { setErr(null); setEdit({ ...s, active: !!s.active }); }} cols={[
          { key: 'n', header: t('common.name'), cell: (s: any) => <span className="font-medium">{s.name}</span> },
          { key: 'p', header: t('common.phone'), cell: (s: any) => <span dir="ltr">{s.phone || '—'}</span> },
          { key: 'e', header: t('common.email'), cell: (s: any) => s.email || '—' },
          { key: 'c', header: t('suppliers.purchases'), align: 'end', cell: (s: any) => <span className="tabular-nums">{s.purchase_count}</span> },
          { key: 't', header: t('suppliers.totalBought'), align: 'end', cell: (s: any) => <span className="tabular-nums">{money(s.purchase_total, lang)}</span> },
          { key: 's', header: t('common.status'), cell: (s: any) => <Badge tone={s.active ? 'green' : 'gray'}>{s.active ? t('common.active') : t('common.inactive')}</Badge> },
        ]} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('suppliers.new')}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button loading={busy} disabled={!edit?.name?.trim()} onClick={save}>{t('common.save')}</Button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.name')} required className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus maxLength={120} /></Field>
          <Field label={t('common.phone')}><Input dir="ltr" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={40} /></Field>
          <Field label={t('common.email')}><Input dir="ltr" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} maxLength={120} /></Field>
          <Field label={t('common.notes')} className="sm:col-span-2"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} maxLength={500} /></Field>
          {edit.id && <Checkbox checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label={t('common.active')} />}
          {err ? <div className="sm:col-span-2"><ErrorBox error={err} /></div> : null}
        </div>}
      </Modal>
    </div>
  );
}
