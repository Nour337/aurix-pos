import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { dateTime, money, num, pname } from '../lib/format';

export interface SaleBundle { sale: any; items: any[]; payments: any[]; returns?: any[] }

/** Sets the printer page size for thermal paper, then opens the browser print dialog. */
export function printWithPageSize(size: '58' | '80' | 'A4') {
  let el = document.getElementById('aurix-page-size') as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = 'aurix-page-size'; document.head.appendChild(el); }
  el.textContent = size === 'A4' ? '@page { size: A4; margin: 0; }' : `@page { size: ${size}mm auto; margin: 0; }`;
  setTimeout(() => window.print(), 50);
}

export default function Receipt({ data, reprint, width }: { data: SaleBundle; reprint?: boolean; width?: '58' | '80' }) {
  const { t, lang, dir } = useI18n();
  const { settings } = useAuth();
  const w = width || settings['receipt.width'] || '80';
  const s = data.sale;
  const m = (v: number) => money(v, lang, { symbol: false });
  const methodLabel = (k: string) => (k === 'other' ? settings['pos.other_method_label'] || t('pay.other') : t(`pay.${k}` as TKey));
  const cashPaid = data.payments.filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0);
  const returnedUnits = data.items.reduce((a, i) => a + (i.returned_qty || 0), 0);
  return (
    <div className={`receipt receipt-${w}`} dir={dir}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: w === '80' ? 26 : 20, fontWeight: 700, letterSpacing: '0.3em' }} dir="ltr">◆ {settings['store.name'] || 'AURIX'}</div>
        <div style={{ fontSize: '0.9em' }}>{lang === 'ar' ? settings['store.tagline_ar'] : settings['store.tagline_en']}</div>
        {(lang === 'ar' ? settings['store.address_ar'] : settings['store.address_en']) && <div>{lang === 'ar' ? settings['store.address_ar'] : settings['store.address_en']}</div>}
        {settings['store.phone'] && <div dir="ltr">{settings['store.phone']}</div>}
        {settings['store.instagram'] && <div dir="ltr">IG: {settings['store.instagram']}</div>}
        {reprint && <div style={{ marginTop: 4, fontWeight: 700, border: '1px solid #000', display: 'inline-block', padding: '0 6px' }}>{t('receipt.reprint')}</div>}
      </div>
      <hr />
      <Row l={t('receipt.invoice')} r={<b dir="ltr">{s.invoice_no}</b>} />
      <Row l={t('receipt.date')} r={dateTime(s.created_at, lang)} />
      <Row l={t('receipt.cashier')} r={s.cashier_name} />
      {s.customer_name && <Row l={t('receipt.customer')} r={`${s.customer_name}${s.customer_phone ? ' · ' + s.customer_phone : ''}`} />}
      <hr />
      {data.items.map((i) => (
        <div key={i.id} style={{ marginBottom: 3 }}>
          <div style={{ fontWeight: 600 }}>{pname(i, lang)}</div>
          <Row l={<span dir="ltr">{num(i.qty, lang)} × {m(i.unit_price)}  <span style={{ fontSize: '0.85em' }}>{i.sku}</span></span>} r={m(i.line_total)} />
          {i.line_discount > 0 && <Row l={`  ${t('receipt.discount')}`} r={`-${m(i.line_discount)}`} />}
        </div>
      ))}
      <hr />
      <Row l={t('receipt.subtotal')} r={m(s.subtotal)} />
      {(s.line_discount + s.order_discount) > 0 && <Row l={t('receipt.discount')} r={`-${m(s.line_discount + s.order_discount)}`} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.35em', fontWeight: 800, margin: '4px 0' }}><span>{t('receipt.total')}</span><span>{money(s.total, lang)}</span></div>
      {data.payments.map((p, k) => <Row key={k} l={`${t('receipt.paid')} · ${methodLabel(p.method)}`} r={m(p.method === 'cash' ? p.amount + (s.change_due || 0) : p.amount)} />)}
      {cashPaid > 0 && s.change_due > 0 && <Row l={t('receipt.change')} r={<b>{m(s.change_due)}</b>} />}
      {returnedUnits > 0 && <><hr /><div>{t('receipt.returned', { n: returnedUnits })}</div></>}
      <hr />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700 }}>{lang === 'ar' ? settings['receipt.footer_ar'] : settings['receipt.footer_en']}</div>
        <div style={{ fontSize: '0.85em' }}>{lang === 'ar' ? settings['receipt.policy_ar'] : settings['receipt.policy_en']}</div>
        <div style={{ fontSize: '0.8em', marginTop: 6 }} dir="ltr">{s.invoice_no}</div>
      </div>
    </div>
  );
}
function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{l}</span><span style={{ whiteSpace: 'nowrap' }}>{r}</span></div>;
}
