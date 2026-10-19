import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '../i18n';
import { get } from '../lib/api';
import { money, pname } from '../lib/format';
import { SearchInput, useDebounced } from './ui';

/** Search-as-you-type product picker (supports scanner Enter for exact SKU/barcode). */
export default function ProductPicker({ onPick, placeholder, exclude = [] }: { onPick: (p: any) => void; placeholder?: string; exclude?: string[] }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const r = useQuery({ queryKey: ['picker', dq], queryFn: () => get('/products', { q: dq, pageSize: 8, status: 'active' }), enabled: dq.length > 0 });
  const rows = (r.data?.rows || []).filter((p: any) => !exclude.includes(p.id));
  const pick = (p: any) => { onPick(p); setQ(''); };
  return (
    <div className="relative">
      <SearchInput value={q} onChange={setQ} placeholder={placeholder || t('purchases.pickProduct')}
        onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); try { pick(await get(`/products/lookup/${encodeURIComponent(q.trim())}`)); } catch { if (rows.length === 1) pick(rows[0]); } } }} />
      {q && rows.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white p-1 shadow-lift ring-1 ring-ink-200 animate-pop">
          {rows.map((p: any) => (
            <li key={p.id}><button type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-royal-50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{pname(p, lang)}</span><span className="text-xs text-ink-400" dir="ltr">{p.sku}</span></span>
              <span className="shrink-0 text-end text-xs text-ink-500"><span className="block">{money(p.sell_price, lang)}</span>{p.qty} {t('common.units')}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
