import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en, { type TKey } from './en';
import ar from './ar';

export type Lang = 'en' | 'ar';
const DICTS = { en, ar } as const;
const KEY = 'aurix.lang';

function initialLang(): Lang {
  try { const v = localStorage.getItem(KEY); if (v === 'ar' || v === 'en') return v; } catch { /* storage blocked */ }
  return 'en'; // English is the default language
}

type Vars = Record<string, string | number>;
interface I18n { lang: Lang; dir: 'ltr' | 'rtl'; t: (k: TKey, v?: Vars) => string; setLang: (l: Lang) => void; toggle: () => void; tx: (k: string, fallback?: string, v?: Vars) => string }
const Ctx = createContext<I18n>(null as any);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  }, [lang, dir]);
  const fill = (s: string, v?: Vars) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? String(v[k]) : `{${k}}`)) : s);
  const t = useCallback((k: TKey, v?: Vars) => fill(DICTS[lang][k] ?? en[k] ?? k, v), [lang]);
  /** Dynamic keys (e.g. server error codes); falls back gracefully. */
  const tx = useCallback((k: string, fallback?: string, v?: Vars) => {
    const d = DICTS[lang] as Record<string, string>;
    return fill(d[k] ?? (en as Record<string, string>)[k] ?? fallback ?? k, v);
  }, [lang]);
  const value = useMemo(() => ({ lang, dir, t, tx, setLang: setLangState, toggle: () => setLangState((l) => (l === 'en' ? 'ar' : 'en')) }), [lang, dir, t, tx]) as I18n;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
export type { TKey };
