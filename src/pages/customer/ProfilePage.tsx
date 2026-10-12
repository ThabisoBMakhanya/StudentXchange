import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { formatDate } from '../../lib/utils';
import { CUSTOMER_NAV } from '../../lib/navigation';

const KYC_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  approved: { label: 'KYC Approved', variant: 'success' },
  pending: { label: 'KYC Pending', variant: 'warning' },
  rejected: { label: 'KYC Rejected', variant: 'error' },
  not_submitted: { label: 'KYC Not Submitted', variant: 'neutral' },
};

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { setMode, clearActiveUser } = useRoleStore();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const kyc = KYC_BADGE[user.kycStatus.toLowerCase()] ?? KYC_BADGE.not_submitted;

  return (
    <AppShell nav={CUSTOMER_NAV}>
      <Header title="Profile" />

      <main className="flex flex-col gap-4 px-4 py-4">
        <section className="card flex items-center gap-4 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-white">
            {user.fullName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-ink">{user.fullName}</p>
            <p className="truncate text-sm text-ink-secondary">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {user.roles.map((r) => (
                <Badge key={r} variant="info" className="capitalize">
                  {r}
                </Badge>
              ))}
              <Badge variant={kyc.variant}>{kyc.label}</Badge>
            </div>
          </div>
        </section>

        <section className="card divide-y divide-surface-border">
          <InfoRow icon="mail" label="Email" value={user.email} />
          <InfoRow icon="phone" label="Phone" value={user.phone} />
          <InfoRow icon="building" label="University" value={user.university} />
          <InfoRow icon="clock" label="Member since" value={formatDate(user.createdAt)} />
        </section>

        {user.roles.includes('seller') && (
          <button
            onClick={() => {
              setMode('seller');
              navigate('/seller');
            }}
            className="btn-secondary w-full"
          >
            <Icon name="store" size={18} />
            Switch to Seller Mode
          </button>
        )}

        <button
          onClick={() => {
            logout();
            clearActiveUser();
            navigate('/login');
          }}
          className="btn-secondary w-full text-ink"
        >
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </main>
    </AppShell>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-secondary">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
