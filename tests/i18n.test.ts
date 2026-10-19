/** Test I (static part): every UI string exists in both languages, with matching placeholders. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import en from '../web/src/i18n/en';
import ar from '../web/src/i18n/ar';

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));

describe('I — translations', () => {
  it('English and Arabic have exactly the same keys', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });
  it('no empty strings and placeholders match', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[k].trim(), k).not.toBe('');
      expect(ar[k].trim(), k).not.toBe('');
      const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
      expect(ph(ar[k]), k).toEqual(ph(en[k]));
    }
  });
  it('Arabic strings are actually translated', () => {
    const same = (Object.keys(en) as (keyof typeof en)[]).filter((k) => en[k] === ar[k] && !/[؀-ۿ]/.test(ar[k]));
    expect(same.filter((k) => !['audit.ip', 'nav.language', 'common.none'].includes(k))).toEqual([]);
  });
  it('every literal t("…") key used in the UI exists', () => {
    const files = walk(path.resolve(__dirname, '../web/src'));
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(300);
  });
  it('every server error code has a translated message', () => {
    const src = fs.readdirSync(path.resolve(__dirname, '../gas')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.resolve(__dirname, '../gas', f), 'utf8')).join('\n');
    const codes = new Set([...src.matchAll(/(?:bad|conflict|forbidden|notFound)\('([a-z_]+)'|AppError\(\d+, '([a-z_]+)'/g)].map((m) => m[1] || m[2]));
    const missing = [...codes].filter((c) => !(`err.${c}` in en));
    // codes that only occur in developer-facing situations
    const devOnly = ['invalid_quantity', 'unknown_category', 'unknown_supplier', 'duplicate_line', 'sale_item_not_found', 'already_voided', 'shift_closed', 'invalid_name', 'unknown_export', 'invalid_change'];
    expect(missing.filter((c) => !devOnly.includes(c))).toEqual([]);
  });
});
