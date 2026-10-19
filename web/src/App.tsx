import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Permission } from '@shared/permissions';
import { useAuth } from './lib/auth';
import Shell, { homeFor } from './components/Shell';
import { Empty, Loading, Logo } from './components/ui';
import { useI18n } from './i18n';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import { ShieldAlert } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Purchases = lazy(() => import('./pages/Purchases'));
const PurchaseNew = lazy(() => import('./pages/PurchaseNew'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Movements = lazy(() => import('./pages/Movements'));
const Counts = lazy(() => import('./pages/Counts'));
const Sales = lazy(() => import('./pages/Sales'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Returns = lazy(() => import('./pages/Returns'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const Audit = lazy(() => import('./pages/Audit'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Sync = lazy(() => import('./pages/Sync'));

function Guard({ perms, children }: { perms: Permission[]; children: ReactNode }) {
  const { can } = useAuth();
  const { t } = useI18n();
  if (!perms.some(can)) return <Empty icon={<ShieldAlert className="h-7 w-7" />} title={t('common.permissionDenied')} />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="grid h-dvh place-items-center bg-navy"><div className="animate-pulse"><Logo light size="lg" /></div></div>;
  if (!user) return <Login />;
  if (user.must_change_password) return <ChangePassword forced />;
  const g = (perms: Permission[], el: ReactNode) => <Guard perms={perms}><Suspense fallback={<Loading />}>{el}</Suspense></Guard>;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={can('reports.view') ? g(['reports.view'], <Dashboard />) : <Navigate to={homeFor(can)} replace />} />
        <Route path="pos" element={g(['pos.sell'], <POS />)} />
        <Route path="products" element={g(['products.manage', 'pos.sell'], <Products />)} />
        <Route path="products/new" element={g(['products.manage'], <ProductForm />)} />
        <Route path="products/:id/edit" element={g(['products.manage'], <ProductForm />)} />
        <Route path="products/:id" element={g(['products.manage', 'pos.sell'], <ProductDetail />)} />
        <Route path="categories" element={g(['products.manage'], <Categories />)} />
        <Route path="suppliers" element={g(['products.manage', 'purchases.manage'], <Suppliers />)} />
        <Route path="purchases" element={g(['purchases.manage'], <Purchases />)} />
        <Route path="purchases/new" element={g(['purchases.manage'], <PurchaseNew />)} />
        <Route path="inventory" element={g(['inventory.manage'], <Inventory />)} />
        <Route path="alerts" element={g(['inventory.manage'], <Alerts />)} />
        <Route path="movements" element={g(['inventory.manage'], <Movements />)} />
        <Route path="counts" element={g(['inventory.manage'], <Counts />)} />
        <Route path="sales" element={g(['sales.view_own', 'sales.view_all'], <Sales />)} />
        <Route path="sales/:id" element={g(['sales.view_own', 'sales.view_all'], <InvoiceDetail />)} />
        <Route path="returns" element={g(['pos.sell'], <Returns />)} />
        <Route path="expenses" element={g(['expenses.create', 'expenses.manage'], <Expenses />)} />
        <Route path="shifts" element={g(['shifts.own', 'shifts.manage'], <Shifts />)} />
        <Route path="reports" element={g(['reports.view'], <Reports />)} />
        <Route path="users" element={g(['users.manage'], <Users />)} />
        <Route path="audit" element={g(['audit.view'], <Audit />)} />
        <Route path="settings" element={g(['settings.manage'], <SettingsPage />)} />
        <Route path="sync" element={g(['sync.manage'], <Sync />)} />
        <Route path="password" element={<ChangePassword />} />
        <Route path="*" element={<Navigate to={homeFor(can)} replace />} />
      </Route>
    </Routes>
  );
}
