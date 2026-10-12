import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrdersForSeller } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatSZL } from '../../lib/utils';
import { SELLER_NAV } from '../../lib/navigation';

export function SellerOrdersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const ordersQuery = useQuery({
    queryKey: ['orders', 'seller', user?.id],
    queryFn: () => getOrdersForSeller(user!.id),
    enabled: !!user,
  });

  return (
    <AppShell nav={SELLER_NAV} sellerModeControls>
      <Header title="Incoming Orders" subtitle="Ship items and deliver services" />

      <main className="px-4 py-4">
        {ordersQuery.isLoading ? (
          <Spinner label="Loading orders…" />
        ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
          <EmptyState
            icon="package"
            title="No orders yet"
            message="When customers buy your listings, orders will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ordersQuery.data.map((order) => {
              const badge = ESCROW_BADGE[order.escrowStatus];
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/seller/orders/${order.id}`)}
                  className="card p-4 text-left transition hover:shadow-card-hover active:scale-[0.99]"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-secondary">{order.id}</span>
                    <span className={badge.classes}>{badge.label}</span>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold text-ink">{order.listingTitle}</p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {order.buyerName} · Qty {order.quantity}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-ink-secondary">
                      {order.listingType === 'physical' ? 'Physical item' : 'Service'}
                    </span>
                    <span className="text-base font-bold text-primary">{formatSZL(order.total)}</span>
                  </div>
                  {order.escrowStatus === 'held' && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                      <Icon name="clock" size={12} /> Awaiting fulfillment
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
