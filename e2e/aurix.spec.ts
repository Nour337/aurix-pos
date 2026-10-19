/**
 * Browser end-to-end run of the core shop workflow (spec §17 A–G + I) against a real server,
 * with screenshots saved to e2e/screenshots/.
 */
import { test, expect, type Page, type Browser } from '@playwright/test';

const SHOTS = 'e2e/screenshots';
const MGR = { u: 'admin', temp: 'Admin-E2E-2026', pw: 'Manager-Strong-1' };
const CASH = { u: 'mona', temp: 'Mona-Temp-123', pw: 'Mona-Strong-1' };
const shot = (p: Page, name: string) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

async function login(page: Page, u: string, pw: string, newPw?: string) {
  await page.goto('/');
  await page.getByLabel(/Username|اسم المستخدم/).fill(u);
  await page.getByLabel(/^Password|كلمة المرور/).fill(pw);
  await page.getByRole('button', { name: /Sign in|تسجيل الدخول/ }).click();
  if (newPw) {
    await expect(page.getByText('Set a new password')).toBeVisible();
    await page.getByLabel('Current password').fill(pw);
    await page.getByLabel('New password', { exact: true }).fill(newPw);
    await page.getByLabel('Confirm new password').fill(newPw);
    await page.getByRole('button', { name: 'Save' }).click();
  }
}
async function newPage(browser: Browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  return ctx.newPage();
}

test.describe.serial('AURIX shop day', () => {
  let mgr: Page; let cash: Page;

  test('manager signs in (forced password change) and creates Rose Body Splash', async ({ browser }) => {
    mgr = await newPage(browser);
    await mgr.goto('/');
    await shot(mgr, '01-login-en');
    await login(mgr, MGR.u, MGR.temp, MGR.pw);
    await expect(mgr.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await mgr.goto('/#/products/new');
    await mgr.getByLabel('Name (English)').fill('Rose Body Splash');
    await mgr.getByLabel('Name (Arabic)').fill('بودي سبلاش الورد');
    await mgr.getByLabel('SKU / Code').fill('AUR-0001');
    await mgr.getByLabel('Selling price').fill('150');
    await mgr.getByLabel('Cost price').fill('100');
    await mgr.getByLabel('Opening stock').fill('5');
    await mgr.getByLabel('Low-stock threshold').fill('2');
    await shot(mgr, '02-product-form');
    await mgr.getByRole('button', { name: 'Save' }).last().click();
    await expect(mgr.getByText('Product created')).toBeVisible();
    await expect(mgr.getByRole('heading', { name: /Rose Body Splash/ })).toBeVisible();
    await shot(mgr, '03-product-detail');
    // load the rest of the starter catalog (skips the existing AUR-0001)
    await mgr.request.post('/__seed');
  });

  test('B — search by name and by SKU', async () => {
    await mgr.goto('/#/products');
    const search = mgr.getByPlaceholder(/Search by name/);
    await search.fill('Rose Body Splash');
    await expect(mgr.locator('tbody tr').first()).toContainText('AUR-0001');
    await expect(mgr.locator('tbody tr').first()).toContainText('150');
    await search.fill('AUR-0001');
    await expect(mgr.locator('tbody tr')).toHaveCount(1);
    await expect(mgr.locator('tbody tr').first()).toContainText('Rose Body Splash');
    await search.fill('');
    await mgr.waitForTimeout(400);
    await shot(mgr, '04-products-list');
  });

  test('manager creates a cashier account', async () => {
    await mgr.goto('/#/users');
    await mgr.getByRole('button', { name: 'New user' }).click();
    await mgr.getByLabel('Username').fill(CASH.u);
    await mgr.getByLabel('Display name').fill('Mona');
    await mgr.getByLabel('Temporary password').fill(CASH.temp);
    await mgr.getByRole('button', { name: 'Save' }).click();
    await expect(mgr.locator('tbody')).toContainText('@mona');
  });

  test('C/D/E — cashier sells, stock 5→4→2→0, alerts reach the manager', async ({ browser }) => {
    cash = await newPage(browser, { width: 1280, height: 800 });
    await login(cash, CASH.u, CASH.temp, CASH.pw);
    await expect(cash.getByText('Open your shift to start selling')).toBeVisible();
    await cash.getByLabel('Opening cash in drawer').fill('500');
    await cash.getByRole('button', { name: 'Open shift' }).click();
    const search = cash.getByPlaceholder(/Search name, SKU or scan barcode/);
    await expect(search).toBeVisible();
    await shot(cash, '05-pos-empty');

    const sellRose = async (qty: number, cashGiven?: string) => {
      await search.fill('AUR-0001'); await search.press('Enter'); // scanner-style exact lookup
      for (let i = 1; i < qty; i++) await cash.locator('aside').getByRole('button').filter({ has: cash.locator('svg.lucide-plus') }).click();
      await cash.locator('aside').getByRole('button', { name: /Charge/ }).click();
      if (cashGiven) await cash.getByLabel('Amount received').fill(cashGiven);
      await cash.getByRole('button', { name: 'Confirm payment & complete sale' }).click();
      await expect(cash.getByText('Sale completed')).toBeVisible();
    };
    // C
    await search.fill('AUR-0001'); await search.press('Enter');
    await cash.locator('aside').getByRole('button', { name: /Charge/ }).click();
    await cash.getByLabel('Amount received').fill('200');
    await expect(cash.getByText('Change due')).toBeVisible();
    await shot(cash, '06-pos-checkout');
    await cash.getByRole('button', { name: 'Confirm payment & complete sale' }).click();
    await expect(cash.getByText('Sale completed')).toBeVisible();
    await expect(cash.getByRole('dialog').getByText(/INV-\d{8}-0001/)).toBeVisible();
    await shot(cash, '07-pos-success');
    await cash.getByRole('button', { name: 'New sale' }).click();
    await expect(cash.getByText('4 in stock').first()).toBeVisible();
    // D
    await sellRose(2);
    await expect(cash.getByText('LOW STOCK').first()).toBeVisible();
    await cash.getByRole('button', { name: 'New sale' }).click();
    await mgr.goto('/#/alerts');
    const roseRow = mgr.locator('tbody tr', { hasText: 'AUR-0001' });
    await expect(roseRow).toHaveCount(1);
    await expect(roseRow).toContainText('LOW STOCK');
    await mgr.reload(); await mgr.reload();
    await expect(mgr.locator('tbody tr', { hasText: 'AUR-0001' })).toHaveCount(1); // no duplicates on refresh
    await shot(mgr, '08-alerts-low');
    // E
    await sellRose(2);
    await cash.getByRole('button', { name: 'New sale' }).click();
    await search.fill('AUR-0001');
    const card = cash.locator('section button', { hasText: 'Rose Body Splash' });
    await expect(card).toBeDisabled();
    await expect(card).toContainText('Out of stock');
    await mgr.reload();
    await expect(mgr.locator('tbody tr', { hasText: 'AUR-0001' })).toContainText('OUT OF STOCK');
    await expect(mgr.locator('tbody tr', { hasText: 'AUR-0001' })).toHaveCount(1);
    await search.fill('');
    await cash.waitForTimeout(400);
    await shot(cash, '09-pos-catalog');
  });

  test('F — cashier return needs manager approval; stock goes back', async () => {
    await cash.goto('/#/returns');
    const inv = 'INV-' + new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date()).replace(/-/g, '') + '-0001';
    await cash.getByPlaceholder(/Invoice number/).fill(inv);
    await cash.getByRole('button', { name: 'Find invoice' }).click();
    await cash.getByLabel('Return qty').fill('1');
    await cash.getByPlaceholder(/Why is the customer/).fill('Customer changed her mind');
    await cash.getByRole('button', { name: 'Process return' }).click();
    await expect(cash.getByText('Manager approval', { exact: true })).toBeVisible();
    await shot(cash, '10-return-approval');
    const dlg = cash.getByRole('dialog');
    await dlg.getByLabel('Username').fill(MGR.u);
    await dlg.getByLabel('Password').fill(MGR.pw);
    await dlg.getByRole('button', { name: 'Approve' }).click();
    await expect(cash.getByText(/Return RET-\d{8}-001 recorded/)).toBeVisible();
    await mgr.goto('/#/products?q=AUR-0001');
    await expect(mgr.locator('tbody tr').first()).toContainText('Low stock');
  });

  test('G — cashier cannot reach manager screens; manager sees full dashboard', async () => {
    await cash.goto('/#/reports');
    await expect(cash.getByText('You do not have permission for this action.')).toBeVisible();
    await expect(cash.locator('nav')).not.toContainText('Reports');
    await cash.goto('/#/products?q=AUR-0001');
    await expect(cash.locator('thead')).not.toContainText('Cost price');
    await mgr.goto('/');
    await expect(mgr.getByText('Net sales').first()).toBeVisible();
    await expect(mgr.getByText('EGP 600').first()).toBeVisible(); // gross: 150 × 5
    await mgr.waitForTimeout(500);
    await shot(mgr, '11-dashboard-en');
    await mgr.goto('/#/sales');
    await shot(mgr, '12-sales');
    await mgr.locator('tbody tr').first().click();
    await expect(mgr.getByText('Invoice details').or(mgr.getByText('Items')).first()).toBeVisible();
    await shot(mgr, '13-invoice');
    await mgr.goto('/#/shifts'); await shot(mgr, '14-shifts');
    await mgr.goto('/#/reports'); await mgr.waitForTimeout(400); await shot(mgr, '15-reports');
    await mgr.goto('/#/sync'); await shot(mgr, '16-google-sheets');
    await mgr.goto('/#/settings'); await shot(mgr, '17-settings');
    await mgr.goto('/#/inventory'); await shot(mgr, '18-inventory');
  });

  test('I — Arabic RTL and back to English LTR', async () => {
    await mgr.goto('/');
    await mgr.getByRole('button', { name: 'Switch language' }).click();
    await expect(mgr.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(mgr.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(mgr.getByRole('heading', { name: 'لوحة التحكم' })).toBeVisible();
    await expect(mgr.getByText('صافي المبيعات').first()).toBeVisible();
    await mgr.waitForTimeout(400);
    await shot(mgr, '19-dashboard-ar');
    await mgr.goto('/#/alerts'); await expect(mgr.getByText('نفد من المخزون').first()).toBeVisible(); await shot(mgr, '20-alerts-ar');
    await mgr.goto('/#/products'); await shot(mgr, '21-products-ar');
    // language persists across reloads
    await mgr.reload();
    await expect(mgr.locator('html')).toHaveAttribute('dir', 'rtl');
    // cashier POS in Arabic on a tablet
    const tab = await cash.context().browser()!.newContext({ viewport: { width: 1024, height: 768 } });
    const p = await tab.newPage();
    await login(p, CASH.u, CASH.pw);
    await p.getByRole('button', { name: 'Switch language' }).click();
    await expect(p.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(p.getByPlaceholder(/ابحث بالاسم أو الكود/)).toBeVisible();
    await p.getByPlaceholder(/ابحث بالاسم أو الكود/).fill('AUR-0007'); await p.getByPlaceholder(/ابحث بالاسم أو الكود/).press('Enter');
    await p.waitForTimeout(300);
    await shot(p, '22-pos-tablet-ar');
    await expect(p.locator('aside').last()).toContainText('حلق دائري ذهبي'); // added via scanner-style lookup, Arabic name shown
    const phone = await tab.newPage(); await phone.setViewportSize({ width: 820, height: 1180 });
    await phone.goto('/#/pos'); await phone.waitForTimeout(500);
    await shot(phone, '23-pos-portrait-tablet-ar');
    await mgr.getByRole('button', { name: 'Switch language' }).click();
    await expect(mgr.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(mgr.getByRole('heading', { name: 'Products' })).toBeVisible();
  });

  test('receipt renders for printing (80 mm)', async () => {
    await mgr.goto('/#/sales');
    await mgr.locator('tbody tr').first().click();
    await mgr.getByRole('button', { name: 'Reprint receipt' }).click().catch(() => {});
    await mgr.emulateMedia({ media: 'print' });
    await expect(mgr.locator('.receipt')).toBeVisible();
    await mgr.locator('.receipt').screenshot({ path: `${SHOTS}/24-receipt-80mm.png` });
    await mgr.emulateMedia({ media: 'screen' });
  });
});
