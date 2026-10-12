import { useQuery } from '@tanstack/react-query';
import { getSellerPayouts } from '../../lib/api';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDateTime, formatSZL } from '../../lib/utils';
import { SELLER_NAV } from '../../lib/navigation';

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' | 'info' }> = {
  paid: { label: 'Paid', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  processing: { label: 'Processing', variant: 'info' },
  failed: { label: 'Failed', variant: 'error' },
};

export function SellerPayoutsPage() {
  const payoutsQuery = useQuery({
    queryKey: ['payouts', 'seller'],
    queryFn: getSellerPayouts,
  });

  const myPayouts = payoutsQuery.data ?? [];
  const totalPaid = myPayouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = myPayouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  return (
    <AppShell nav={SELLER_NAV} sellerModeControls>
      <Header title="Payouts" subtitle="Earnings released from escrow" />

      <main className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-medium text-ink-secondary">Total paid out</p>
            <p className="mt-1 text-lg font-extrabold text-primary-600">{formatSZL(totalPaid)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-ink-secondary">Pending</p>
            <p className="mt-1 text-lg font-extrabold text-ink">{formatSZL(totalPending)}</p>
          </div>
        </div>

        {payoutsQuery.isLoading ? (
          <Spinner label="Loading payouts…" />
        ) : myPayouts.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No payouts yet"
            message="When buyers confirm receipt of your orders, earnings appear here."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {myPayouts.map((payout) => {
              const badge = STATUS_BADGE[payout.status];
              return (
                <div key={payout.id} className="card flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <Icon name="wallet" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{payout.orderId}</p>
                    <p className="text-xs text-ink-secondary">{formatDateTime(payout.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{formatSZL(payout.amount)}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
