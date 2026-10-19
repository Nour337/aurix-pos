import { useState } from 'react';
import { Languages, LockKeyhole, User } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../lib/auth';
import { getApiUrl, isValidApiUrl, post, setApiUrl } from '../lib/api';
import { Button, ErrorBox, Field, Input, Logo } from '../components/ui';

export default function Login() {
  const { t, toggle } = useI18n();
  const { refresh } = useAuth();
  const [username, setU] = useState(''); const [password, setP] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [server, setServer] = useState(!getApiUrl());
  const [url, setUrl] = useState(getApiUrl());
  const urlBad = url.trim() !== '' && !isValidApiUrl(url);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await post('/auth/login', { username: username.trim(), password }); await refresh(); }
    catch (e) { setErr(e); setP(''); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #D8B15A 0 1px, transparent 1px 28px)' }} />
        <div className="absolute -bottom-40 -start-40 h-[32rem] w-[32rem] rounded-full border border-gold-400/20" />
        <div className="absolute -bottom-24 -start-24 h-[24rem] w-[24rem] rounded-full border border-gold-400/30" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <Logo light size="lg" />
          <div>
            <p className="font-display text-5xl font-medium leading-tight text-white"><span className="text-gold-300">{t('auth.hero1')}</span><br />{t('auth.hero2')}</p>
            <p className="mt-4 max-w-md text-royal-200">{t('app.tagline')} — POS · Inventory · Reports</p>
          </div>
          <div className="h-px w-24 bg-gold-400" />
        </div>
      </div>
      <div className="flex flex-col bg-soft">
        <div className="flex justify-between p-5">
          <span className="lg:hidden"><Logo /></span><span className="hidden lg:block" />
          <button onClick={toggle} className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:border-gold-400"><Languages className="h-4 w-4 text-gold-500" />{t('nav.language')}</button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          {server ? (
            <form onSubmit={(e) => { e.preventDefault(); if (!urlBad && url.trim()) { setApiUrl(url); setServer(false); } }} className="w-full max-w-sm animate-in">
              <h1 className="font-display text-4xl font-semibold text-navy">{t('auth.serverTitle')}</h1>
              <p className="mb-8 mt-2 text-sm text-ink-500">{t('auth.serverHint')}</p>
              <Field label={t('auth.serverUrl')} error={urlBad ? t('auth.serverInvalid') : undefined}>
                <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="h-12 font-mono text-xs" autoFocus invalid={urlBad} />
              </Field>
              <Button type="submit" size="lg" className="mt-4 w-full" disabled={!url.trim() || urlBad}>{t('auth.serverSave')}</Button>
            </form>
          ) : (
          <form onSubmit={submit} className="w-full max-w-sm animate-in">
            <h1 className="font-display text-4xl font-semibold text-navy">{t('auth.title')}</h1>
            <p className="mb-8 mt-2 text-sm text-ink-500">{t('auth.subtitle')}</p>
            <div className="space-y-4">
              <Field label={t('auth.username')}>
                <div className="relative"><User className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input autoFocus autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} className="h-12 ps-10" /></div>
              </Field>
              <Field label={t('auth.password')}>
                <div className="relative"><LockKeyhole className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} className="h-12 ps-10" /></div>
              </Field>
              {err ? <ErrorBox error={err} /> : null}
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!username || !password}>{busy ? t('auth.signingIn') : t('auth.signIn')}</Button>
              <button type="button" onClick={() => setServer(true)} className="w-full text-center text-xs text-ink-400 hover:text-royal-600">{t('auth.serverChange')}</button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
