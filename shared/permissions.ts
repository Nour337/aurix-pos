/**
 * AURIX permission model — shared by server (enforcement) and web (UI hints only).
 * The server is the only source of truth: hiding a button in the UI is never relied on.
 */
export const ROLES = ['manager', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // POS / cashier
  'pos.sell',
  'sales.view_own',
  'receipts.print',
  'shifts.own',
  // optional cashier grants (manager toggles them per cashier)
  'sales.view_all',
  'discount.apply',
  'returns.process',
  'expenses.create',
  'products.view_cost',
  // manager-only by default
  'products.manage',
  'inventory.manage',
  'purchases.manage',
  'sales.cancel',
  'reports.view',
  'expenses.manage',
  'shifts.manage',
  'users.manage',
  'audit.view',
  'settings.manage',
  'sync.manage',
  'export.data',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Permissions a manager may grant to a cashier account. Everything else stays manager-only. */
export const GRANTABLE_TO_CASHIER: Permission[] = [
  'sales.view_all',
  'discount.apply',
  'returns.process',
  'expenses.create',
  'products.view_cost',
];

export const CASHIER_BASE: Permission[] = ['pos.sell', 'sales.view_own', 'receipts.print', 'shifts.own'];

export function effectivePermissions(role: Role, extra: string[] = []): Permission[] {
  if (role === 'manager') return [...PERMISSIONS];
  const granted = extra.filter((p): p is Permission => (GRANTABLE_TO_CASHIER as string[]).includes(p));
  return Array.from(new Set([...CASHIER_BASE, ...granted]));
}

export const PAYMENT_METHODS = ['cash', 'card', 'instapay', 'vodafone_cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEFAULT_MIN_STOCK = 2;

export type StockLevel = 'normal' | 'low' | 'out';
export function stockLevel(qty: number, minStock: number): StockLevel {
  if (qty <= 0) return 'out';
  if (qty <= minStock) return 'low';
  return 'normal';
}
