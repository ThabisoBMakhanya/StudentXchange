import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoleStore } from '../stores/roleStore';
import type { ReactNode } from 'react';

import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { CustomerHomePage } from '../pages/customer/CustomerHomePage';
import { ListingDetailPage } from '../pages/customer/ListingDetailPage';
import { CartPage } from '../pages/customer/CartPage';
import { CheckoutPage } from '../pages/customer/CheckoutPage';
import { OrdersPage } from '../pages/customer/OrdersPage';
import { OrderDetailPage } from '../pages/customer/OrderDetailPage';
import { ProfilePage } from '../pages/customer/ProfilePage';
import { SellerDashboardPage } from '../pages/seller/SellerDashboardPage';
import { SellerListingsPage } from '../pages/seller/SellerListingsPage';
import { CreateListingPage } from '../pages/seller/CreateListingPage';
import { SellerOrdersPage } from '../pages/seller/SellerOrdersPage';
import { SellerOrderDetailPage } from '../pages/seller/SellerOrderDetailPage';
import { SellerKycPage } from '../pages/seller/SellerKycPage';
import { SellerPayoutsPage } from '../pages/seller/SellerPayoutsPage';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';
import { AdminLayout } from '../pages/admin/AdminLayout';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminKycPage } from '../pages/admin/AdminKycPage';
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { AdminEscrowPage } from '../pages/admin/AdminEscrowPage';
import { AdminDisputesPage } from '../pages/admin/AdminDisputesPage';
import { AdminPayoutsPage } from '../pages/admin/AdminPayoutsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage';

// ─── Guards ──────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireSeller({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.includes('seller')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user?.roles.includes('admin')) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

/**
 * Portal 1 root — pins single-role users to their only portal view.
 * Dual-role users land on the customer home (role switcher available).
 * Admins with marketplace roles land on customer home (they can reach /admin via profile).
 */
function MarketplaceRoot() {
  const user = useAuthStore((s) => s.user);
  const mode = useRoleStore((s) => s.mode);
  if (!user) return <Navigate to="/login" replace />;
  if (user.roles.includes('admin') && user.roles.length === 1) {
    return <Navigate to="/admin" replace />;
  }
  if (user.roles.length === 1 && user.roles[0] === 'seller') {
    return <Navigate to="/seller" replace />;
  }
  if (user.roles.length === 1 && user.roles[0] === 'customer') {
    return <Navigate to="/" replace />;
  }
  // Dual-role: honor the role switcher
  return <Navigate to={mode === 'seller' ? '/seller' : '/'} replace />;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Portal 1 — auth
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Portal 1 — marketplace (combined seller + customer)
  {
    path: '/',
    element: (
      <RequireAuth>
        <MarketplaceRoot />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <CustomerHomePage /> },
      { path: 'listing/:id', element: <ListingDetailPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },

  // Portal 1 — seller mode
  {
    path: '/seller',
    element: (
      <RequireSeller>
        <Outlet />
      </RequireSeller>
    ),
    children: [
      { index: true, element: <SellerDashboardPage /> },
      { path: 'listings', element: <SellerListingsPage /> },
      { path: 'listings/new', element: <CreateListingPage /> },
      { path: 'listings/:id', element: <SellerListingsPage /> },
      { path: 'orders', element: <SellerOrdersPage /> },
      { path: 'orders/:id', element: <SellerOrderDetailPage /> },
      { path: 'kyc', element: <SellerKycPage /> },
      { path: 'payouts', element: <SellerPayoutsPage /> },
    ],
  },

  // Portal 2 — admin
  { path: '/admin/login', element: <AdminLoginPage /> },
  {
    path: '/admin',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'kyc', element: <AdminKycPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'escrow', element: <AdminEscrowPage /> },
      { path: 'disputes', element: <AdminDisputesPage /> },
      { path: 'payouts', element: <AdminPayoutsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'audit', element: <AdminAuditPage /> },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
]);
