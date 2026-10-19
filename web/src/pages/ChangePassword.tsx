import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';
import { Button, Card, ErrorBox, Field, Input, Logo, PageHeader, useToast } from '../components/ui';

export default function ChangePassword({ forced }: { forced?: boolean }) {
  const { t } = useI18n();
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [conf, setConf] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const mismatch = conf.length > 0 && next !== conf;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (mismatch) return;
    setBusy(true); setErr(null);
    try { await post('/auth/change-password', { current: cur, next }); toast('success', t('auth.changed')); setCur(''); setNext(''); setConf(''); await refresh(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const form = (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('auth.current')}><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label={t('auth.new')} hint={t('auth.rules')}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Field label={t('auth.confirmNew')} error={mismatch ? t('auth.mismatch') : undefined}><Input type="password" autoComplete="new-password" value={conf} invalid={mismatch} onChange={(e) => setConf(e.target.value)} /></Field>
      {err ? <ErrorBox error={err} /> : null}
      <div className="flex gap-2"><Button type="submit" loading={busy} disabled={!cur || !next || mismatch} icon={<KeyRound className="h-4 w-4" />}>{t('common.save')}</Button>
        {forced && <Button type="button" variant="ghost" onClick={logout}>{t('nav.logout')}</Button>}</div>
    </form>
  );
  if (!forced) return <div className="max-w-lg"><PageHeader title={t('nav.changePassword')} /><Card>{form}</Card></div>;
  return (
    <div className="grid min-h-dvh place-items-center bg-soft p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center"><Logo size="lg" /></div>
        <Card><h1 className="font-display text-2xl font-semibold text-navy">{t('auth.changeTitle')}</h1><p className="mb-5 mt-1 text-sm text-ink-500">{t('auth.changeSubtitle')}</p>{form}</Card>
      </div>
    </div>
  );
}
