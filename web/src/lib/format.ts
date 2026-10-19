import type { Lang } from '../i18n';

const nf = (lang: Lang, min = 2, max = 2) => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG', { minimumFractionDigits: min, maximumFractionDigits: max });
/** Money is stored in piasters (1 EGP = 100). */
export function money(p: number | null | undefined, lang: Lang, opts: { symbol?: boolean; compact?: boolean } = {}) {
  const v = (p || 0) / 100;
  const s = opts.compact && Math.abs(v) >= 10000
    ? new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-EG', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    : nf(lang, Number.isInteger(v) ? 0 : 2).format(v);
  if (opts.symbol === false) return s;
  return lang === 'ar' ? `${s} ج.م` : `EGP ${s}`;
}
export const num = (n: number | null | undefined, lang: Lang) => nf(lang, 0, 2).format(n || 0);
export const toPiasters = (s: string | number) => { const n = typeof s === 'number' ? s : parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
export const fromPiasters = (p: number | null | undefined) => (p == null ? '' : String((p / 100).toFixed(2)).replace(/\.00$/, ''));

const TZ = 'Africa/Cairo';
export function dateTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
export function dateOnly(ymdOrIso: string | null | undefined, lang: Lang) {
  if (!ymdOrIso) return '—';
  const d = ymdOrIso.length === 10 ? new Date(ymdOrIso + 'T12:00:00Z') : new Date(ymdOrIso);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { timeZone: TZ, dateStyle: 'medium' }).format(d);
}
export function timeOnly(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { timeZone: TZ, timeStyle: 'short' }).format(new Date(iso));
}
export const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
/** Localized product name with graceful fallback. */
export const pname = (p: { name_en?: string; name_ar?: string } | null | undefined, lang: Lang) => (p ? (lang === 'ar' && p.name_ar ? p.name_ar : p.name_en || p.name_ar || '') : '');
export const cname = (c: { name_en?: string; name_ar?: string; category_name_en?: string; category_name_ar?: string } | null | undefined, lang: Lang) =>
  c ? (lang === 'ar' ? (c as any).category_name_ar || (c as any).name_ar || (c as any).category_name_en || (c as any).name_en : (c as any).category_name_en || (c as any).name_en) || '' : '';
