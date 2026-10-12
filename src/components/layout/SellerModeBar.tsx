import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { Icon } from '../ui/Icon';
import { RoleSwitcher } from './RoleSwitcher';

export function SellerModeBar() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const clearActiveUser = useRoleStore((state) => state.clearActiveUser);

  const signOut = () => {
    logout();
    clearActiveUser();
    navigate('/login');
  };

  return (
    <div className="safe-top sticky top-0 z-20 flex items-center gap-1 border-b border-surface-border bg-white/95 pr-2 backdrop-blur">
      <div className="min-w-0 flex-1">
        <RoleSwitcher compact />
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-ink active:scale-95"
        aria-label="Sign out"
        title="Sign out"
      >
        <Icon name="logout" size={19} />
      </button>
    </div>
  );
}
