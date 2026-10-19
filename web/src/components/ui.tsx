import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Search, X, XCircle, PackageOpen } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { ApiError } from '../lib/api';
import { money as fmtMoney } from '../lib/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ── Brand mark ───────────────────────────────────────────────────────────────────────────
export function Logo({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'text-xl', md: 'text-2xl', lg: 'text-5xl' }[size];
  return (
    <span className="inline-flex items-center gap-2 select-none" dir="ltr" aria-label="AURIX">
      <svg viewBox="0 0 24 24" className={size === 'lg' ? 'h-9 w-9' : 'h-5 w-5'} aria-hidden>
        <path d="M12 2 21 12 12 22 3 12Z" fill="none" stroke="#D8B15A" strokeWidth="1.6" />
        <path d="M12 6.5 16.5 12 12 17.5 7.5 12Z" fill="#D8B15A" />
      </svg>
      <span className={cx('font-display font-semibold tracking-[0.28em]', s, light ? 'text-white' : 'text-navy')}>AURIX</span>
    </span>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger' | 'subtle';
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-royal-500 text-white hover:bg-royal-600 active:bg-royal-700 shadow-sm',
  gold: 'bg-gold-400 text-navy hover:bg-gold-300 active:bg-gold-500 shadow-sm font-semibold',
  ghost: 'text-ink-600 hover:bg-ink-100',
  outline: 'border border-ink-200 bg-white text-ink hover:border-royal-300 hover:text-royal-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  subtle: 'bg-royal-50 text-royal-600 hover:bg-royal-100',
};
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' | 'xl'; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
    const sz = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-5 text-base gap-2', xl: 'h-16 px-6 text-lg gap-3' }[size];
    return (
      <button ref={ref} disabled={disabled || loading} className={cx('inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 whitespace-nowrap', sz, btnStyles[variant], className)} {...rest}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  });

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} className={cx('grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink disabled:opacity-40', className)} {...rest}>{children}</button>;
}

// ── Form controls ────────────────────────────────────────────────────────────────────────
const fieldBase = 'w-full rounded-xl border border-ink-200 bg-white px-3.5 text-sm text-ink placeholder:text-ink-400 transition focus:border-royal-400 focus:outline-none focus:ring-4 focus:ring-royal-100 disabled:bg-ink-100';
export function Field({ label, hint, error, children, className, required }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={cx('block', className)}>
      <label className="block">
        {label && <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">{label}{required && <span className="text-red-500" aria-hidden> *</span>}</span>}
        {children}
      </label>
      {error ? <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-10', invalid && 'border-red-400 focus:ring-red-100', className)} {...rest} />;
});
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, 'min-h-[80px] py-2.5', className)} {...rest} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldBase, 'h-10 pe-8', className)} {...rest}>{children}</select>;
}
export function MoneyInput({ value, onChange, className, invalid, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <Input inputMode="decimal" value={value} invalid={invalid} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))} className={cx('pe-12 tabular-nums', className)} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-xs font-medium text-ink-400">{t('common.egp')}</span>
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder, autoFocus, className, inputRef, onKeyDown }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; className?: string; inputRef?: React.Ref<HTMLInputElement>; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <Input ref={inputRef} type="search" value={value} autoFocus={autoFocus} onKeyDown={onKeyDown} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="ps-10" />
    </div>
  );
}
export function Checkbox({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-ink-300 text-royal-500 accent-royal-500" />
      <span><span className="block text-sm text-ink">{label}</span>{hint && <span className="block text-xs text-ink-400">{hint}</span>}</span>
    </label>
  );
}
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-xl bg-ink-100 p-1', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', value === o.value ? 'bg-white text-royal-600 shadow-sm' : 'text-ink-500 hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────
export function Card({ children, className, title, action, padded = true, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean; subtitle?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 animate-in', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-ink">{title}</h3>{subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}</div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="font-display text-3xl font-semibold leading-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'gray' | 'blue' | 'gold' | 'green' | 'red' | 'amber';
const tones: Record<Tone, string> = {
  gray: 'bg-ink-100 text-ink-600', blue: 'bg-royal-50 text-royal-600 ring-royal-200', gold: 'bg-gold-50 text-gold-700 ring-gold-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', red: 'bg-red-50 text-red-700 ring-red-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200',
};
export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-transparent', tones[tone], className)}>{children}</span>;
}
export function StockBadge({ qty, min }: { qty: number; min: number }) {
  const { t } = useI18n();
  if (qty <= 0) return <Badge tone="red">{t('products.stock.out')}</Badge>;
  if (qty <= min) return <Badge tone="amber">{t('products.stock.low')}</Badge>;
  return <Badge tone="green">{t('products.stock.normal')}</Badge>;
}

export function Stat({ label, value, hint, tone = 'default', icon, onClick, emphasis }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'gold' | 'red' | 'amber' | 'green'; icon?: ReactNode; onClick?: () => void; emphasis?: boolean }) {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('group relative w-full overflow-hidden rounded-2xl p-5 text-start shadow-card ring-1 transition animate-in', emphasis ? 'bg-navy text-white ring-navy' : 'bg-white ring-ink-200/60', onClick && 'hover:-translate-y-0.5 hover:shadow-lift hover:ring-gold-300')}>
      {emphasis && <span className="absolute inset-x-0 top-0 h-0.5 bg-gold-400" />}
      <div className="flex items-start justify-between gap-2">
        <span className={cx('text-xs font-semibold uppercase tracking-wide', emphasis ? 'text-royal-200' : 'text-ink-400')}>{label}</span>
        {icon && <span className={cx('grid h-8 w-8 place-items-center rounded-lg', emphasis ? 'bg-white/10 text-gold-300' : tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : tone === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-gold-50 text-gold-600')}>{icon}</span>}
      </div>
      <div className={cx('mt-2 text-2xl font-semibold tabular-nums tracking-tight', emphasis ? 'text-gold-300' : tone === 'gold' ? 'text-gold-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink')}>{value}</div>
      {hint && <div className={cx('mt-1 text-xs', emphasis ? 'text-royal-200' : 'text-ink-400')}>{hint}</div>}
    </Comp>
  );
}

export function Empty({ title, hint, icon, action }: { title: ReactNode; hint?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gold-50 text-gold-500">{icon || <PackageOpen className="h-7 w-7" />}</div>
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Spinner({ className }: { className?: string }) { return <Loader2 className={cx('h-5 w-5 animate-spin text-royal-500', className)} />; }
export function Loading() {
  const { t } = useI18n();
  return <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-400"><Spinner />{t('common.loading')}</div>;
}
export function Skeleton({ className }: { className?: string }) { return <div className={cx('animate-pulse rounded-xl bg-ink-100', className)} />; }

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = useErrorMessage()(error);
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">{msg}</div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>{t('common.retry')}</Button>}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────────────────
export interface Col<T> { key: string; header: ReactNode; cell: (r: T) => ReactNode; className?: string; align?: 'start' | 'end' | 'center' }
export function Table<T>({ cols, rows, onRowClick, rowKey, empty, loading, dense }: { cols: Col<T>[]; rows: T[] | undefined; onRowClick?: (r: T) => void; rowKey: (r: T) => string; empty?: ReactNode; loading?: boolean; dense?: boolean }) {
  const { t } = useI18n();
  if (loading && !rows) return <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (!rows?.length) return <>{empty ?? <Empty title={t('common.noResults')} />}</>;
  const al = (a?: string) => (a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start');
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-soft/60">
            {cols.map((c) => <th key={c.key} className={cx('whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400', al(c.align), c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx('transition-colors', onRowClick && 'cursor-pointer hover:bg-royal-50/40')}>
              {cols.map((c) => <td key={c.key} className={cx('px-4', dense ? 'py-2' : 'py-3', al(c.align), c.className)}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t, dir } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return total ? <div className="px-5 py-3 text-xs text-ink-400">{t('common.showing', { n: total, total })}</div> : null;
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft; const Next = dir === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
      <span>{t('common.showing', { n: Math.min(pageSize, total - (page - 1) * pageSize), total })}</span>
      <div className="flex items-center gap-1">
        <IconButton label={t('common.prev')} disabled={page <= 1} onClick={() => onPage(page - 1)}><Prev className="h-4 w-4" /></IconButton>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <IconButton label={t('common.next')} disabled={page >= pages} onClick={() => onPage(page + 1)}><Next className="h-4 w-4" /></IconButton>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift animate-pop sm:rounded-2xl', w)}>
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-navy">{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-soft/50 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>, document.body);
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel, danger, loading, children }: { open: boolean; onClose: () => void; onConfirm: () => void; title: ReactNode; message?: ReactNode; confirmLabel?: ReactNode; danger?: boolean; loading?: boolean; children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel || t('common.confirm')}</Button></>}>
      {message && <p className="text-sm text-ink-600">{message}</p>}
      {children}
    </Modal>
  );
}

// ── Toasts ───────────────────────────────────────────────────────────────────────────────
type ToastT = { id: number; tone: 'success' | 'error' | 'info' | 'warning'; text: ReactNode };
const ToastCtx = createContext<(tone: ToastT['tone'], text: ReactNode, ms?: number) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastT[]>([]);
  const idRef = useRef(0);
  const push = useCallback((tone: ToastT['tone'], text: ReactNode, ms = 3500) => {
    const id = ++idRef.current;
    setItems((x) => [...x.slice(-3), { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), ms);
  }, []);
  const icon = { success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, error: <XCircle className="h-5 w-5 text-red-500" />, info: <Info className="h-5 w-5 text-royal-500" />, warning: <AlertTriangle className="h-5 w-5 text-amber-500" /> };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 no-print" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-ink shadow-lift ring-1 ring-ink-200 animate-pop">
            {icon[i.tone]}<div className="flex-1">{i.text}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Maps server error codes to translated, human messages. */
export function useErrorMessage() {
  const { tx } = useI18n();
  return useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.code === 'validation_error' && Array.isArray(e.details) && e.details.length) {
        return `${tx('err.validation_error')}: ${e.details.map((d: any) => d.path || d.message).join(', ')}`;
      }
      const d = e.details && !Array.isArray(e.details) ? e.details : {};
      return tx(`err.${e.code}`, e.message, d);
    }
    return tx('common.error');
  }, [tx]);
}

export function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const h = setTimeout(() => setD(v), ms); return () => clearTimeout(h); }, [v, ms]);
  return d;
}

export function Money({ v, className, strong }: { v: number | null | undefined; className?: string; strong?: boolean }) {
  const { lang } = useI18n();
  return <span className={cx('tabular-nums whitespace-nowrap', strong && 'font-semibold', className)}>{fmtMoney(v, lang)}</span>;
}
export type { TKey };
