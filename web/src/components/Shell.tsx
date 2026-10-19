import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, ShoppingBag, Package, Tags, Truck, PackagePlus, Boxes, BellRing, ArrowLeftRight, ClipboardCheck, Receipt, Undo2,
  Wallet, Clock, BarChart3, Users, ScrollText, Settings, Sheet, LogOut, KeyRound, Menu, X, Languages, Cloud, CloudOff, AlertTriangle, WifiOff,
} from 'lucide-react';
import type { Permission } from '@shared/permissions';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { get } from '../lib/api';
import { pname } from '../lib/format';
import { Badge, cx, IconButton, Logo, useToast } from './ui';

interface NavItem { to: string; key: TKey; icon: any; perms: Permission[] }
const NAV: { group: TKey; items: NavItem[] }[] = [
  { group: 'nav.group.sell', items: [
    { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, perms: ['reports.view'] },
    { to: '/pos', key: 'nav.pos', icon: ShoppingBag, perms: ['pos.sell'] },
    { to: '/sales', key: 'nav.sales', icon: Receipt, perms: ['sales.view_own', 'sales.view_all'] },
    { to: '/returns', key: 'nav.returns', icon: Undo2, perms: ['pos.sell'] },
    { to: '/shifts', key: 'nav.shifts', icon: Clock, perms: ['shifts.own', 'shifts.manage'] },
  ] },
  { group: 'nav.group.stock', items: [
    { to: '/products', key: 'nav.products', icon: Package, perms: ['products.manage', 'pos.sell'] },
    { to: '/categories', key: 'nav.categories', icon: Tags, perms: ['products.manage'] },
    { to: '/suppliers', key: 'nav.suppliers', icon: Truck, perms: ['products.manage', 'purchases.manage'] },
    { to: '/purchases', key: 'nav.purchases', icon: PackagePlus, perms: ['purchases.manage'] },
    { to: '/inventory', key: 'nav.inventory', icon: Boxes, perms: ['inventory.manage'] },
    { to: '/alerts', key: 'nav.alerts', icon: BellRing, perms: ['inventory.manage'] },
    { to: '/movements', key: 'nav.movements', icon: ArrowLeftRight, perms: ['inventory.manage'] },
    { to: '/counts', key: 'nav.counts', icon: ClipboardCheck, perms: ['inventory.manage'] },
  ] },
  { group: 'nav.group.money', items: [
    { to: '/expenses', key: 'nav.expenses', icon: Wallet, perms: ['expenses.create', 'expenses.manage'] },
    { to: '/reports', key: 'nav.reports', icon: BarChart3, perms: ['reports.view'] },
  ] },
  { group: 'nav.group.admin', items: [
    { to: '/users', key: 'nav.users', icon: Users, perms: ['users.manage'] },
    { to: '/audit', key: 'nav.audit', icon: ScrollText, perms: ['audit.view'] },
    { to: '/settings', key: 'nav.settings', icon: Settings, perms: ['settings.manage'] },
    { to: '/sync', key: 'nav.sync', icon: Sheet, perms: ['sync.manage'] },
  ] },
];

export const homeFor = (can: (p: Permission) => boolean) => (can('reports.view') ? '/' : '/pos');

function SheetBadge() {
  const { t } = useI18n();
  const nav = useNavigate();
  return <button onClick={() => nav('/sync')} className="hidden sm:block"><Badge tone="green"><Cloud className="h-3.5 w-3.5" />{t('sync.badge.ok')}</Badge></button>;
}

/** Polls open stock alerts; toasts each NEW alert once (seen IDs remembered per user on this device). */
function AlertBell({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['alerts-summary'], queryFn: () => get('/inventory/alerts/summary'), refetchInterval: 15_000 });
  const first = useRef(true);
  useEffect(() => {
    if (!data) return;
    const key = `aurix.seenAlerts.${userId}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }
    const fresh = (data.latest as any[]).filter((a) => !seen.includes(a.id));
    if (fresh.length) {
      fresh.slice(0, 3).forEach((a) => toast('warning', <span><b>{a.type === 'out_of_stock' ? t('alerts.out') : t('alerts.low')}</b> — {pname(a, lang)} ({a.sku}) · {t('alerts.remaining')}: {a.qty_at_trigger}</span>, 7000));
      try { localStorage.setItem(key, JSON.stringify([...fresh.map((a) => a.id), ...seen].slice(0, 300))); } catch { /* ignore */ }
    }
    first.current = false;
  }, [data, userId, toast, t, lang]);
  const n = data ? data.low + data.out : 0;
  return (
    <IconButton label={t('nav.alerts')} onClick={() => nav('/alerts')} className="relative">
      <BellRing className="h-5 w-5" />
      {n > 0 && <span className={cx('absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white', data.out ? 'bg-red-600' : 'bg-amber-500')}>{n}</span>}
    </IconButton>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => { const a = () => setOn(true), b = () => setOn(false); window.addEventListener('online', a); window.addEventListener('offline', b); return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); }; }, []);
  return on;
}

export default function Shell({ children }: { children?: ReactNode }) {
  const { t, toggle } = useI18n();
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const online = useOnline();
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!user) return null;
  const isPos = loc.pathname === '/pos';

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy text-royal-100">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light />
        <IconButton label={t('common.close')} onClick={() => setOpen(false)} className={cx('text-royal-200 hover:bg-white/10', isPos ? 'xl:hidden' : 'lg:hidden')}><X className="h-5 w-5" /></IconButton>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
        {NAV.map((g) => {
          const items = g.items.filter((i) => i.perms.some(can));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-royal-300/70">{t(g.group)}</div>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => cx(
                  'group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-white/10 text-white' : 'text-royal-100/80 hover:bg-white/5 hover:text-white')}>
                  {({ isActive }) => (<>
                    {isActive && <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-gold-400" />}
                    <i.icon className={cx('h-[18px] w-[18px]', isActive ? 'text-gold-300' : 'text-royal-300 group-hover:text-royal-100')} />
                    {t(i.key)}
                  </>)}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-3 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-400 font-semibold text-navy">{user.display_name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{user.display_name}</div><div className="text-xs text-royal-300">{t(`users.role.${user.role}` as TKey)}</div></div>
        </div>
        <button onClick={() => nav('/password')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-royal-100/80 hover:bg-white/5 hover:text-white"><KeyRound className="h-4 w-4" />{t('nav.changePassword')}</button>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-royal-100/80 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4 rtl:rotate-180" />{t('nav.logout')}</button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-soft">
      <aside className={cx('no-print hidden w-64 shrink-0', isPos ? 'xl:block' : 'lg:block')}>{sidebar}</aside>
      {open && <div className={cx('no-print fixed inset-0 z-40', isPos ? 'xl:hidden' : 'lg:hidden')}><div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 start-0 w-72 shadow-lift animate-in">{sidebar}</aside></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur lg:px-6">
          <IconButton label={t('nav.menu')} onClick={() => setOpen(true)} className={isPos ? 'xl:hidden' : 'lg:hidden'}><Menu className="h-5 w-5" /></IconButton>
          <div className={isPos ? 'xl:hidden' : 'lg:hidden'}><Logo size="sm" /></div>
          <div className="flex-1" />
          {!online && <Badge tone="red"><WifiOff className="h-3.5 w-3.5" />{t('common.offline').split('.')[0]}</Badge>}
          {can('sync.manage') && <SheetBadge />}
          {can('inventory.manage') && <AlertBell userId={user.id} />}
          <button onClick={toggle} className="flex h-9 items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-600 transition hover:border-gold-400 hover:text-navy" aria-label="Switch language">
            <Languages className="h-4 w-4 text-gold-500" />{t('nav.language')}
          </button>
        </header>
        <main className={cx('flex-1 overflow-y-auto', isPos ? '' : 'p-4 lg:p-8')}>
          <div className={cx(!isPos && 'mx-auto max-w-[1400px]')}>{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}
