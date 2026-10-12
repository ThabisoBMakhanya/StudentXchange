import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrdersForBuyer } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatSZL } from '../../lib/utils';
import { CUSTOMER_NAV } from '../../lib/navigation';

export function OrdersPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const ordersQuery = useQuery({
    queryKey: ['orders', 'buyer', user?.id],
    queryFn: () => getOrdersForBuyer(user!.id),
    enabled: !!user,
  });

  return (
    <AppShell nav={CUSTOMER_NAV}>
      <Header title="My Orders" subtitle="Track purchases and escrow status" />

      <main className="px-4 py-4">
        {ordersQuery.isLoading ? (
          <Spinner label="Loading orders…" />
        ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
          <EmptyState
            icon="package"
            title="No orders yet"
            message="Items and services you buy will appear here with live escrow tracking."
            action={
              <button onClick={() => navigate('/')} className="btn-primary">
                Start shopping
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {ordersQuery.data.map((order) => {
              const badge = ESCROW_BADGE[order.escrowStatus];
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="card p-4 text-left transition hover:shadow-card-hover active:scale-[0.99]"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-secondary">{order.id}</span>
                    <span className={badge.classes}>{badge.label}</span>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold text-ink">{order.listingTitle}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-ink-secondary">
                      {order.listingType === 'physical' ? 'Physical item' : 'Service'} · Qty {order.quantity}
                    </span>
                    <span className="text-base font-bold text-primary">{formatSZL(order.total)}</span>
                  </div>
                  {order.escrowStatus === 'held' && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary">
                      <Icon name="shield" size={12} /> Funds held in escrow — confirm receipt when it arrives
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
