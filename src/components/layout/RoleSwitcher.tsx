import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enableMarketplaceRole } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { cx } from '../../lib/utils';

/**
 * Role switcher shown at the top of the home screen for dual-role users.
 * Single-role users never see this — the router pins them to their role.
 */
export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { mode, setMode } = useRoleStore();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  const switchMode = async (role: 'customer' | 'seller') => {
    if (!user || pendingRole) return;
    setError('');
    setPendingRole(role);
    try {
      if (!user.roles.includes(role)) {
        updateUser(await enableMarketplaceRole(role));
      }
      setMode(role);
      navigate(role === 'seller' ? '/seller' : '/');
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : 'Could not switch mode.');
    } finally {
      setPendingRole(null);
    }
  };

  return (
    <div className={compact ? 'min-w-0 w-full' : 'mx-auto max-w-lg px-4 pt-3'}>
      <div className="flex rounded-2xl border border-surface-border bg-surface p-1.5 shadow-sm">
        {(['customer', 'seller'] as const).map((role) => (
          <button
            key={role}
            onClick={() => void switchMode(role)}
            disabled={pendingRole !== null}
            className={cx(
              'min-h-tap flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition-all duration-200 active:scale-[0.98]',
              mode === role
                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-btn-primary'
                : 'text-ink-secondary hover:bg-white hover:text-ink',
            )}
          >
            {pendingRole === role ? 'Enabling…' : `${role === 'customer' ? 'Customer' : 'Seller'} Mode`}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}
