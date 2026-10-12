import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayouts, markPayoutPaid } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDateTime, formatSZL } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' | 'info' }> = {
  paid: { label: 'Paid', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'info' },
  failed: { label: 'Failed', variant: 'error' },
};

export function AdminPayoutsPage() {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');

  const payoutsQuery = useQuery({ queryKey: ['admin-payouts'], queryFn: getPayouts });

  const paidMutation = useMutation({
    mutationFn: (payoutId: string) => markPayoutPaid(adminId, payoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Payout Processing</h2>
        <p className="text-xs text-ink-secondary">Release seller earnings via MTN MoMo</p>
      </div>

      {payoutsQuery.isLoading ? (
        <Spinner label="Loading payouts…" />
      ) : !payoutsQuery.data || payoutsQuery.data.length === 0 ? (
        <EmptyState icon="wallet" title="No payouts yet" message="Payouts are created when escrow funds release." />
      ) : (
        <div className="flex flex-col gap-2">
          {payoutsQuery.data.map((payout) => {
            const badge = STATUS_BADGE[payout.status];
            return (
              <div key={payout.id} className="card flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Icon name="wallet" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{payout.sellerName}</p>
                  <p className="text-xs text-ink-secondary">
                    {payout.orderId} · {formatDateTime(payout.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink">{formatSZL(payout.amount)}</p>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                {payout.status === 'pending' && (
                  <button
                    onClick={() => paidMutation.mutate(payout.id)}
                    disabled={paidMutation.isPending}
                    className="min-h-tap rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition active:scale-95"
                  >
                    Mark paid
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
