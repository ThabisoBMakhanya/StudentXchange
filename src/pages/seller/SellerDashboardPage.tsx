import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getOrdersForSeller, getSellerListings } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatSZL } from '../../lib/utils';
import { SELLER_NAV } from '../../lib/navigation';

export function SellerDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const ordersQuery = useQuery({
    queryKey: ['orders', 'seller', user?.id],
    queryFn: () => getOrdersForSeller(user!.id),
    enabled: !!user,
  });

  const listingsQuery = useQuery({
    queryKey: ['listings', 'seller', user?.id],
    queryFn: () => getSellerListings(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  const orders = ordersQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const heldOrders = orders.filter((o) => o.escrowStatus === 'held' || o.escrowStatus === 'withheld_by_admin');
  const heldValue = heldOrders.reduce((sum, o) => sum + o.total, 0);
  const releasedValue = orders
    .filter((o) => o.escrowStatus === 'released')
    .reduce((sum, o) => sum + (o.total - o.commission), 0);

  return (
    <AppShell nav={SELLER_NAV} sellerModeControls>
      <Header
        title="Seller Dashboard"
        subtitle={`Welcome back, ${user.fullName.split(' ')[0]}`}
        right={
          <button
            onClick={() => navigate('/seller/kyc')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-ink transition hover:bg-surface active:scale-95"
            aria-label="KYC status"
          >
            <Icon name="shield" size={20} />
          </button>
        }
      />
      <main className="flex flex-col gap-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="shield" label="In escrow" value={formatSZL(heldValue)} sub={`${heldOrders.length} order(s)`} />
          <StatCard icon="wallet" label="Earned" value={formatSZL(releasedValue)} sub="After commission" />
          <StatCard icon="tag" label="Listings" value={String(listings.length)} sub={`${listings.filter((l) => l.status === 'active').length} active`} />
          <StatCard icon="package" label="Orders" value={String(orders.length)} sub="Total received" />
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Needs attention</h2>
            <button
              onClick={() => navigate('/seller/orders')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {ordersQuery.isLoading ? (
            <Spinner label="Loading orders…" />
          ) : heldOrders.length === 0 ? (
            <div className="card p-6 text-center">
              <Icon name="check" size={28} className="mx-auto text-primary" />
              <p className="mt-2 text-sm font-semibold text-ink">All caught up</p>
              <p className="mt-0.5 text-xs text-ink-secondary">No orders waiting on you right now.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {heldOrders.slice(0, 4).map((order) => {
                const badge = ESCROW_BADGE[order.escrowStatus];
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/seller/orders/${order.id}`)}
                    className="card flex items-center gap-3 p-3 text-left transition hover:shadow-card-hover active:scale-[0.99]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <Icon name="package" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{order.listingTitle}</p>
                      <p className="text-xs text-ink-secondary">
                        {order.buyerName} · {formatSZL(order.total)}
                      </p>
                    </div>
                    <span className={badge.classes}>{badge.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <button onClick={() => navigate('/seller/listings/new')} className="btn-primary w-full">
          <Icon name="plus" size={18} />
          Create new listing
        </button>
      </main>
    </AppShell>
  );
}
