import { useState, type ReactNode } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { downloadExport } from '../lib/api';
import { money, todayYmd } from '../lib/format';
import { Button, Field, Input, Modal, Segmented, cx } from './ui';

// ── Date range ───────────────────────────────────────────────────────────────────────────
export type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'year' | 'custom';
export interface Range { preset: Preset; from?: string; to?: string }
export function RangeFilter({ value, onChange, presets = ['today', 'yesterday', 'week', 'month', 'custom'] }: { value: Range; onChange: (r: Range) => void; presets?: Preset[] }) {
  const { t } = useI18n();
  const [from, setFrom] = useState(value.from || todayYmd());
  const [to, setTo] = useState(value.to || todayYmd());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented value={value.preset} onChange={(p) => onChange(p === 'custom' ? { preset: p, from, to } : { preset: p })} options={presets.map((p) => ({ value: p, label: t(`range.${p}` as TKey) }))} />
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2 animate-in">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" aria-label={t('common.from')} />
          <span className="text-ink-400">–</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" aria-label={t('common.to')} />
          <Button size="sm" onClick={() => onChange({ preset: 'custom', from, to })}>{t('range.apply')}</Button>
        </div>
      )}
    </div>
  );
}
/** Converts a preset into explicit from/to dates (Cairo business days) for list filters. */
export function rangeDates(r: Range): { from: string; to: string } {
  const today = todayYmd();
  const add = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  switch (r.preset) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: add(today, -1), to: add(today, -1) };
    case 'week': { const dow = new Date(today + 'T12:00:00Z').getUTCDay(); return { from: add(today, -((dow + 1) % 7)), to: today }; }
    case 'month': return { from: today.slice(0, 8) + '01', to: today };
    case 'last30': return { from: add(today, -29), to: today };
    case 'year': return { from: today.slice(0, 5) + '01-01', to: today };
    default: return { from: r.from || today, to: r.to || today };
  }
}

export function ExportButton({ entity, query }: { entity: string; query?: Record<string, any> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" loading={busy} icon={<Download className="h-4 w-4" />} onClick={async () => { setBusy(true); try { await downloadExport(entity, query); } finally { setBusy(false); } }}>{t('common.export')}</Button>;
}

// ── Manager approval (on-the-spot override; credentials go straight to the server, never stored) ─
export function ApprovalModal({ open, onClose, onApprove, loading }: { open: boolean; onClose: () => void; onApprove: (a: { username: string; password: string }) => void; loading?: boolean }) {
  const { t } = useI18n();
  const [username, setU] = useState(''); const [password, setP] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={t('pos.approvalTitle')} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant="gold" icon={<ShieldCheck className="h-4 w-4" />} loading={loading} disabled={!username || !password} onClick={() => onApprove({ username, password })}>{t('pos.approve')}</Button></>}>
      <p className="mb-4 text-sm text-ink-500">{t('pos.approvalHint')}</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (username && password) onApprove({ username, password }); }}>
        <Field label={t('auth.username')}><Input autoComplete="off" value={username} onChange={(e) => setU(e.target.value)} autoFocus /></Field>
        <Field label={t('auth.password')}><Input type="password" autoComplete="off" value={password} onChange={(e) => setP(e.target.value)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ── Charts (lightweight SVG, brand colors, RTL-aware) ────────────────────────────────────
export function BarChart({ data, height = 180, valueKey = 'value', secondaryKey, labelFmt }: { data: { label: string; [k: string]: any }[]; height?: number; valueKey?: string; secondaryKey?: string; labelFmt?: (l: string) => string }) {
  const { lang, dir } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d[valueKey] || 0, secondaryKey ? d[secondaryKey] || 0 : 0)));
  const rows = dir === 'rtl' ? [...data].reverse() : data;
  const w = 100 / Math.max(rows.length, 1);
  const step = Math.max(1, Math.ceil(rows.length / 10));
  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={height * g} y2={height * g} stroke="#E3E7EF" strokeWidth="0.3" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />)}
        {rows.map((d, i) => {
          const v = d[valueKey] || 0; const h = (v / max) * (height - 6);
          const s = secondaryKey ? ((d[secondaryKey] || 0) / max) * (height - 6) : 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * w} y={0} width={w} height={height} fill="transparent" />
              {secondaryKey && <rect x={i * w + w * 0.18} y={height - s} width={w * 0.64} height={s} rx="0.6" fill="#D9E3FA" />}
              <rect x={i * w + w * 0.28} y={height - h} width={w * 0.44} height={h} rx="0.6" fill={hover === i ? '#D8B15A' : '#1747B5'} className="transition-colors" />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex text-[10px] text-ink-400">
        {rows.map((d, i) => <span key={i} className="text-center" style={{ width: `${w}%` }}>{i % step === 0 ? (labelFmt ? labelFmt(d.label) : d.label) : ''}</span>)}
      </div>
      {hover !== null && rows[hover] && (
        <div className="pointer-events-none absolute top-0 rounded-lg bg-navy px-2.5 py-1.5 text-xs text-white shadow-lift" style={{ left: `min(calc(${(hover + 0.5) * w}% ), calc(100% - 140px))` }}>
          <div className="text-royal-200">{labelFmt ? labelFmt(rows[hover].label) : rows[hover].label}</div>
          <div className="font-semibold text-gold-300">{money(rows[hover][valueKey], lang)}</div>
          {secondaryKey && <div className="text-royal-200">{money(rows[hover][secondaryKey], lang)}</div>}
        </div>
      )}
    </div>
  );
}

export function HBars({ rows, format }: { rows: { label: ReactNode; value: number; sub?: ReactNode }[]; format: (n: number) => ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate text-ink">{r.label}</span><span className="shrink-0 font-semibold tabular-nums text-ink">{format(r.value)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className={cx('h-full rounded-full', i === 0 ? 'bg-gold-400' : 'bg-royal-500')} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
          {r.sub && <div className="mt-0.5 text-xs text-ink-400">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}
