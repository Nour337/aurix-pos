import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { ApiError, get, post } from '../lib/api';
import { dateTime, pname } from '../lib/format';
import { Button, Card, Checkbox, Confirm, ErrorBox, Input, PageHeader, SearchInput, Select, Table, cx, useToast } from '../components/ui';

const KEY = 'aurix.countDraft';
export default function Counts() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [onlyDiff, setOnlyDiff] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null); const [conflict, setConflict] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(counted)); } catch { /* ignore */ } }, [counted]);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/catalog/categories') });
  const prods = useQuery({ queryKey: ['count-products', cat], queryFn: () => get('/products', { category: cat, pageSize: 500, status: 'active', sort: 'name' }) });
  const history = useQuery({ queryKey: ['counts'], queryFn: () => get('/inventory/counts') });
  const rows: any[] = useMemo(() => {
    const all = prods.data?.rows || [];
    const s = q.trim().toLowerCase();
    return all.filter((p: any) => (!s || [p.name_en, p.name_ar, p.sku, p.barcode].some((v) => String(v || '').toLowerCase().includes(s))) && (!onlyDiff || (counted[p.id] !== undefined && counted[p.id] !== '' && parseInt(counted[p.id], 10) !== p.qty)));
  }, [prods.data, q, onlyDiff, counted]);
  const entered = (prods.data?.rows || []).filter((p: any) => counted[p.id] !== undefined && counted[p.id] !== '');
  const diffs = entered.filter((p: any) => parseInt(counted[p.id], 10) !== p.qty).length;

  const apply = async (force = false) => {
    setBusy(true); setErr(null);
    try {
      const r = await post('/inventory/counts', { note, force, items: entered.map((p: any) => ({ productId: p.id, counted: parseInt(counted[p.id], 10), expected: p.qty })) });
      toast('success', t('count.applied', { n: r.discrepancies })); setCounted({}); setNote(''); setConflict(false);
      qc.invalidateQueries();
    } catch (e) { if (e instanceof ApiError && e.code === 'stock_changed_during_count') setConflict(true); else setErr(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={t('count.title')} subtitle={t('count.subtitle')} actions={<>
        <Button variant="ghost" disabled={!entered.length} onClick={() => setCounted({})}>{t('count.reset')}</Button>
        <Button variant="gold" icon={<ClipboardCheck className="h-4 w-4" />} disabled={!entered.length} loading={busy} onClick={() => apply(false)}>{t('count.apply')} ({diffs})</Button></>} />
      {err ? <div className="mb-4"><ErrorBox error={err} /></div> : null}
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('products.searchPh')} className="min-w-[240px] flex-1" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48"><option value="">{t('common.category')}: {t('common.all')}</option>{(cats.data?.rows || []).map((c: any) => <option key={c.id} value={c.id}>{pname(c, lang)}</option>)}</Select>
          <Checkbox checked={onlyDiff} onChange={setOnlyDiff} label={t('count.onlyDiff')} />
          <span className="text-xs text-ink-400">{t('count.counter', { done: entered.length, total: prods.data?.rows.length || 0 })} · {t('count.draftSaved')}</span>
        </div>
        <Table dense rows={rows} loading={prods.isLoading} rowKey={(p: any) => p.id} cols={[
          { key: 'n', header: t('common.name'), cell: (p: any) => <div><div className="font-medium">{pname(p, lang)}</div><div className="font-mono text-[11px] text-ink-400" dir="ltr">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</div></div> },
          { key: 's', header: t('count.system'), align: 'end', cell: (p: any) => <span className="tabular-nums">{p.qty}</span> },
          { key: 'c', header: t('count.counted'), align: 'end', cell: (p: any) => <Input inputMode="numeric" value={counted[p.id] ?? ''} placeholder="—" aria-label={t('count.counted')}
            onChange={(e) => setCounted({ ...counted, [p.id]: e.target.value.replace(/\D/g, '') })} className="ms-auto h-9 w-24 text-end tabular-nums" /> },
          { key: 'd', header: t('count.diff'), align: 'end', cell: (p: any) => { const v = counted[p.id]; if (v === undefined || v === '') return '—'; const d = parseInt(v, 10) - p.qty;
            return <span dir="ltr" className={cx('font-semibold tabular-nums', d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-ink-400')}>{d > 0 ? '+' : ''}{d}</span>; } },
        ]} />
      </Card>
      <div className="mt-4 max-w-xl"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('common.notes')} maxLength={300} /></div>
      <Card className="mt-6" title={t('count.history')} padded={false}>
        <Table dense rows={history.data?.rows} rowKey={(c: any) => c.id} cols={[
          { key: 'no', header: '#', cell: (c: any) => <span className="font-mono text-xs" dir="ltr">{c.count_no}</span> },
          { key: 'd', header: t('common.date'), cell: (c: any) => dateTime(c.created_at, lang) },
          { key: 'i', header: t('count.counted'), align: 'end', cell: (c: any) => c.items_counted },
          { key: 'x', header: t('count.diff'), align: 'end', cell: (c: any) => c.discrepancies },
          { key: 'u', header: t('common.user'), cell: (c: any) => c.user_name },
          { key: 'n', header: t('common.notes'), cell: (c: any) => c.note },
        ]} />
      </Card>
      <Confirm open={conflict} onClose={() => setConflict(false)} title={t('count.apply')} message={t('count.changed')} loading={busy} onConfirm={() => apply(true)} />
    </div>
  );
}
