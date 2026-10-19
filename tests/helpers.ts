import { randomUUID } from 'node:crypto';
import { createGas, gasClient } from './gas-emulator.js';

export const MANAGER_PW = 'Manager-Pass-2026';
export const CASHIER_PW = 'Cashier-Pass-2026';
export type Client = ReturnType<typeof gasClient>;

/** Fresh emulated spreadsheet + Apps Script backend, a manager and a cashier (both past the forced password change). */
export async function setup() {
  const gas = createGas({ adminPassword: 'Temp-Admin-123' });
  const manager = gasClient(gas);
  let r = await manager.post('/api/auth/login', { username: 'admin', password: 'Temp-Admin-123' });
  if (r.status !== 200) throw new Error('login failed ' + JSON.stringify(r.body));
  r = await manager.post('/api/auth/change-password', { current: 'Temp-Admin-123', next: MANAGER_PW });
  if (r.status !== 200) throw new Error('chpw failed ' + JSON.stringify(r.body));
  r = await manager.post('/api/users', { username: 'sara', display_name: 'Sara', role: 'cashier', password: 'Temp-Cash-123' });
  if (r.status !== 200) throw new Error('create cashier failed ' + JSON.stringify(r.body));
  const cashierId = r.body.id;
  const cashier = gasClient(gas);
  await cashier.post('/api/auth/login', { username: 'sara', password: 'Temp-Cash-123' });
  await cashier.post('/api/auth/change-password', { current: 'Temp-Cash-123', next: CASHIER_PW });
  return { gas, ss: gas.ss, manager, cashier, cashierId, newClient: () => gasClient(gas) };
}

export const txn = () => randomUUID();
export const sell = (c: Client, productId: string, qty: number, unitPrice: number, extra: any = {}) =>
  c.post('/api/sales/checkout', { client_txn_id: txn(), items: [{ product_id: productId, qty }], payments: [{ method: 'cash', amount: unitPrice * qty }], ...extra });
