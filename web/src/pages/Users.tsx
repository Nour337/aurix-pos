import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { GRANTABLE_TO_CASHIER } from '@shared/permissions';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get, patch, post } from '../lib/api';
import { dateTime } from '../lib/format';
import { Badge, Button, Card, Checkbox, ErrorBox, Field, Input, Modal, PageHeader, Select, Table, useToast } from '../components/ui';

export default function Users() {
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['users'], queryFn: () => get('/users') });
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (edit.id) {
        const body: any = { display_name: edit.display_name, role: edit.role, permissions: edit.permissions, max_discount_pct: Number(edit.max_discount_pct || 0), active: edit.active };
        if (edit.reset_password) body.reset_password = edit.reset_password;
        await patch(`/users/${edit.id}`, body);
      } else {
        await post('/users', { username: edit.username, display_name: edit.display_name, role: edit.role, password: edit.password, permissions: edit.permissions, max_discount_pct: Number(edit.max_discount_pct || 0) });
      }
      qc.invalidateQueries({ queryKey: ['users'] }); setEdit(null); toast('success', t('common.saved'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const togglePerm = (p: string) => setEdit({ ...edit, permissions: edit.permissions.includes(p) ? edit.permissions.filter((x: string) => x !== p) : [...edit.permissions, p] });
  return (
    <div>
      <PageHeader title={t('users.title')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setErr(null); setEdit({ username: '', display_name: '', role: 'cashier', password: '', permissions: [], max_discount_pct: 0, active: true }); }}>{t('users.new')}</Button>} />
      <Card padded={false}>
        {q.error ? <ErrorBox error={q.error} /> : null}
        <Table rows={q.data?.rows} loading={q.isLoading} rowKey={(u: any) => u.id} onRowClick={(u: any) => { setErr(null); setEdit({ ...u, reset_password: '' }); }} cols={[
          { key: 'n', header: t('users.displayName'), cell: (u: any) => <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-gold-100 text-sm font-semibold text-gold-700">{u.display_name.slice(0, 1)}</span><div><div className="font-medium">{u.display_name}</div><div className="text-xs text-ink-400" dir="ltr">@{u.username}</div></div></div> },
          { key: 'r', header: t('users.role'), cell: (u: any) => <Badge tone={u.role === 'manager' ? 'gold' : 'blue'}>{t(`users.role.${u.role}` as TKey)}</Badge> },
          { key: 'p', header: t('users.permissions'), cell: (u: any) => u.role === 'manager' ? '—' : <div className="flex flex-wrap gap-1">{u.permissions.map((p: string) => <Badge key={p}>{t(`perm.${p}` as TKey)}</Badge>)}</div> },
          { key: 'l', header: t('users.lastLogin'), cell: (u: any) => <span className="text-xs">{u.last_login_at ? dateTime(u.last_login_at, lang) : '—'}</span> },
          { key: 's', header: t('common.status'), cell: (u: any) => <Badge tone={u.active ? 'green' : 'gray'}>{u.active ? t('common.active') : t('common.inactive')}</Badge> },
        ]} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? edit.display_name : t('users.new')} size="lg"
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button loading={busy} onClick={save} disabled={!edit?.display_name || (!edit?.id && (!edit?.username || !edit?.password))}>{t('common.save')}</Button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          {!edit.id && <Field label={t('users.username')} required hint="a-z 0-9 . _ -"><Input dir="ltr" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value.toLowerCase() })} maxLength={32} autoFocus /></Field>}
          <Field label={t('users.displayName')} required><Input value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} maxLength={60} /></Field>
          <Field label={t('users.role')}><Select value={edit.role} disabled={edit.id === me?.id} onChange={(e) => setEdit({ ...edit, role: e.target.value })}><option value="cashier">{t('users.role.cashier')}</option><option value="manager">{t('users.role.manager')}</option></Select></Field>
          {!edit.id ? <Field label={t('users.tempPassword')} required hint={`${t('auth.rules')} ${t('users.tempHint')}`}><Input type="text" autoComplete="off" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>
            : <Field label={t('users.resetPassword')} hint={t('users.tempHint')}><Input type="text" autoComplete="off" value={edit.reset_password} onChange={(e) => setEdit({ ...edit, reset_password: e.target.value })} placeholder="••••••••" /></Field>}
          {edit.role === 'cashier' && <div className="sm:col-span-2 rounded-xl bg-soft p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('users.permissions')}</div>
            <div className="grid gap-1 sm:grid-cols-2">{GRANTABLE_TO_CASHIER.map((p) => <Checkbox key={p} checked={edit.permissions.includes(p)} onChange={() => togglePerm(p)} label={t(`perm.${p}` as TKey)} />)}</div>
            {edit.permissions.includes('discount.apply') && <Field label={t('users.maxDiscount')} className="mt-3 max-w-xs"><Input inputMode="numeric" value={edit.max_discount_pct} onChange={(e) => setEdit({ ...edit, max_discount_pct: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></Field>}
          </div>}
          {edit.id && edit.id !== me?.id && <Checkbox checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label={t('common.active')} />}
          {err ? <div className="sm:col-span-2"><ErrorBox error={err} /></div> : null}
        </div>}
      </Modal>
    </div>
  );
}
