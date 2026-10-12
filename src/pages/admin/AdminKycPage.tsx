import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, setKycStatus } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

const KYC_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
  approved: { label: 'Approved', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'error' },
  not_submitted: { label: 'Not submitted', variant: 'neutral' },
};

export function AdminKycPage() {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers });

  const kycMutation = useMutation({
    mutationFn: ({ userId, status, note }: { userId: string; status: 'approved' | 'rejected'; note?: string }) =>
      setKycStatus(adminId, userId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
    },
  });

  const pending = (usersQuery.data ?? []).filter((u) => u.kycStatus === 'pending');
  const reviewed = (usersQuery.data ?? []).filter(
    (u) => u.kycStatus === 'approved' || u.kycStatus === 'rejected',
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">KYC Approvals</h2>
        <p className="text-xs text-ink-secondary">Verify seller identities before they can receive payouts</p>
      </div>

      {usersQuery.isLoading ? (
        <Spinner label="Loading…" />
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-sm font-bold text-ink">
              Pending review {pending.length > 0 && `(${pending.length})`}
            </h3>
            {pending.length === 0 ? (
              <EmptyState icon="check" title="No pending KYC" message="All seller documents have been reviewed." />
            ) : (
              <div className="flex flex-col gap-2">
                {pending.map((user) => (
                  <div key={user.id} className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-bg text-base font-extrabold text-ink">
                        {user.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{user.fullName}</p>
                        <p className="truncate text-xs text-ink-secondary">{user.email}</p>
                        <p className="text-xs text-ink-secondary">{user.university}</p>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => kycMutation.mutate({ userId: user.id, status: 'approved', note: 'Documents verified.' })}
                        disabled={kycMutation.isPending}
                        className="btn-primary flex-1 py-2 text-sm"
                      >
                        <Icon name="check" size={16} /> Approve
                      </button>
                      <button
                        onClick={() => kycMutation.mutate({ userId: user.id, status: 'rejected', note: 'Documents unclear — resubmission requested.' })}
                        disabled={kycMutation.isPending}
                        className="min-h-tap flex-1 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98]"
                      >
                        <Icon name="x" size={16} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-ink">Reviewed</h3>
            <div className="flex flex-col gap-2">
              {reviewed.map((user) => {
                const badge = KYC_BADGE[user.kycStatus];
                return (
                  <div key={user.id} className="card flex items-center gap-3 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-sm font-extrabold text-ink">
                      {user.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
                      <p className="text-xs text-ink-secondary">Joined {formatDate(user.createdAt)}</p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
