import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, PlugZap, XCircle } from 'lucide-react';
import { useI18n } from '../i18n';
import { get, getApiUrl, post } from '../lib/api';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Stat, Table, useToast } from '../components/ui';

export default function Sync() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['sheets-status'], queryFn: () => get('/admin/sheets') });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const init = async () => {
    setBusy(true); setErr(null);
    try { const r = await post('/admin/sheets/init'); toast('success', t('sync.initOk', { created: r.created.join(', ') || '—' })); qc.invalidateQueries({ queryKey: ['sheets-status'] }); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const total = s.tabs.reduce((a: number, x: any) => a + x.rows, 0);
  return (
    <div>
      <PageHeader title={t('sync.title')} subtitle={t('sync.howItWorks')}
        actions={<a href={s.spreadsheetUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-royal-500 px-4 text-sm font-medium text-white hover:bg-royal-600"><ExternalLink className="h-4 w-4" />{t('sync.openSheet')}</a>} />
      {err ? <div className="mb-4"><ErrorBox error={err} /></div> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('sync.status')} value={s.ok ? <Badge tone="green"><CheckCircle2 className="h-3.5 w-3.5" />{t('sync.connected')}</Badge> : <Badge tone="red"><XCircle className="h-3.5 w-3.5" />{t('sync.notConfigured')}</Badge>} />
        <Stat label={t('sync.tabsTitle')} value={`${s.tabs.filter((x: any) => x.exists).length} / ${s.tabs.length}`} />
        <Stat label={t('sync.rows')} value={total} />
        <Stat label={t('sync.backend')} value={<span className="text-base">Apps Script v{s.version}</span>} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title={s.name} padded={false}>
          <Table dense rows={s.tabs} rowKey={(r: any) => r.tab} cols={[
            { key: 't', header: t('sync.tab'), cell: (r: any) => <span className="font-medium">{r.tab}</span> },
            { key: 'r', header: t('sync.rows'), align: 'end', cell: (r: any) => r.rows },
            { key: 's', header: t('common.status'), cell: (r: any) => r.exists ? <Badge tone="green">OK</Badge> : <Badge tone="red">—</Badge> },
          ]} />
        </Card>
        <Card title={t('sync.test')}>
          <p className="mb-4 text-sm text-ink-500">{t('sync.resyncHint')}</p>
          <Button icon={<PlugZap className="h-4 w-4" />} loading={busy} onClick={init}>{t('sync.test')}</Button>
          <div className="mt-6 text-xs text-ink-400">{t('sync.apiUrl')}</div>
          <code className="mt-1 block break-all rounded-lg bg-soft p-2 text-[11px] text-ink-600" dir="ltr">{getApiUrl()}</code>
        </Card>
      </div>
    </div>
  );
}
