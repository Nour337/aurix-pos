import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { get, patch, post } from '../lib/api';
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Table, useToast, Checkbox } from '../components/ui';

export default function Categories() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['categories'], queryFn: () => get('/catalog/categories') });
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = { name_en: edit.name_en.trim(), name_ar: edit.name_ar.trim(), active: edit.active };
      if (edit.id) await patch(`/catalog/categories/${edit.id}`, body); else await post('/catalog/categories', body);
      qc.invalidateQueries({ queryKey: ['categories'] }); setEdit(null); toast('success', t('common.saved'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title={t('categories.title')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit({ name_en: '', name_ar: '', active: true }); }}>{t('categories.new')}</Button>} />
      <Card padded={false}>
        {q.error ? <ErrorBox error={q.error} /> : null}
        <Table rows={q.data?.rows} loading={q.isLoading} rowKey={(c: any) => c.id} onRowClick={(c: any) => { setErr(null); setEdit({ ...c, active: !!c.active }); }} cols={[
          { key: 'en', header: t('categories.nameEn'), cell: (c: any) => <span className="font-medium">{c.name_en}</span> },
          { key: 'ar', header: t('categories.nameAr'), cell: (c: any) => <span dir="rtl">{c.name_ar || '—'}</span> },
          { key: 'n', header: t('categories.count'), align: 'end', cell: (c: any) => <span className="tabular-nums">{c.product_count}</span> },
          { key: 's', header: t('common.status'), cell: (c: any) => <Badge tone={c.active ? 'green' : 'gray'}>{c.active ? t('common.active') : t('common.inactive')}</Badge> },
        ]} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('categories.new')} size="sm"
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button loading={busy} disabled={!edit?.name_en?.trim()} onClick={save}>{t('common.save')}</Button></>}>
        {edit && <div className="space-y-4">
          <Field label={t('categories.nameEn')} required><Input value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} autoFocus maxLength={80} /></Field>
          <Field label={t('categories.nameAr')}><Input dir="rtl" value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} maxLength={80} /></Field>
          {edit.id && <Checkbox checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label={t('common.active')} />}
          {err ? <ErrorBox error={err} /> : null}
        </div>}
      </Modal>
    </div>
  );
}
