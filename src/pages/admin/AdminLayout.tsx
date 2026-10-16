import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';

const ADMIN_NAV = [
  { to: '/admin', icon: 'chart', label: 'Dashboard', match: ['/admin'] },
  { to: '/admin/escrow', icon: 'shield', label: 'Escrow', match: ['/admin/escrow'] },
  { to: '/admin/orders', icon: 'package', label: 'Orders', match: ['/admin/orders'] },
  { to: '/admin/users', icon: 'users', label: 'Users', match: ['/admin/users'] },
  { to: '/admin/disputes', icon: 'alert', label: 'Disputes', match: ['/admin/disputes'] },
];

const ADMIN_MORE = [
  { to: '/admin/kyc', label: 'KYC approvals', icon: 'shield' },
  { to: '/admin/categories', label: 'Categories', icon: 'grid' },
  { to: '/admin/payouts', label: 'Payouts', icon: 'wallet' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
  { to: '/admin/audit', label: 'Audit log', icon: 'history' },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const clearActiveUser = useRoleStore((state) => state.clearActiveUser);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (showMore) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showMore]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-surface">
      <header className="safe-top sticky top-0 z-20 border-b border-surface-border bg-ink text-white">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary">
            <Icon name="shield" size={18} />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-tight">StudentXchange Admin</h1>
            <p className="text-[10px] text-white/50">Restricted administrator access</p>
          </div>
          <button
            onClick={() => {
              logout();
              clearActiveUser();
              navigate('/login');
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
            aria-label="Sign out"
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      {showMore && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50" onClick={() => setShowMore(false)}>
          <div
            className="safe-bottom w-full max-w-lg rounded-t-3xl bg-white p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-admin-tools-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
            <h2 id="more-admin-tools-title" className="mb-3 text-sm font-bold text-ink">More admin tools</h2>
            <div className="grid grid-cols-2 gap-2">
              {ADMIN_MORE.map((item) => (
                <button
                  key={item.to}
                  onClick={() => {
                    setShowMore(false);
                    navigate(item.to);
                  }}
                  className="flex min-h-tap items-center gap-3 rounded-xl border border-surface-border bg-surface p-3 text-left transition hover:border-primary-200 active:scale-[0.98]"
                >
                  <Icon name={item.icon} size={18} className="text-primary" />
                  <span className="text-sm font-semibold text-ink">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-surface-border bg-white">
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {ADMIN_NAV.map((item) => {
            const active = item.match.some((m) => location.pathname.startsWith(m));
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cx(
                  'flex min-h-tap min-w-tap flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95',
                  active ? 'text-primary' : 'text-ink-secondary/60 hover:text-ink-secondary',
                )}
              >
                <Icon name={item.icon} size={22} />
                <span className={cx('text-[10px] font-semibold', active && 'text-primary')}>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMore(true)}
            className={cx(
              'flex min-h-tap min-w-tap flex-1 flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95',
              ADMIN_MORE.some((m) => location.pathname.startsWith(m.to))
                ? 'text-primary'
                : 'text-ink-secondary/60 hover:text-ink-secondary',
            )}
          >
            <Icon name="grid" size={22} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>
      <div className="h-16" />
    </div>
  );
}
