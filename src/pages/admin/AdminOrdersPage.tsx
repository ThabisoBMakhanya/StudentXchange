import { useQuery } from '@tanstack/react-query';
import { getAllOrders } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatDateTime, formatSZL } from '../../lib/utils';

export function AdminOrdersPage() {
  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getAllOrders });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Order Monitoring</h2>
        <p className="text-xs text-ink-secondary">Every order with live escrow state</p>
      </div>

      {ordersQuery.isLoading ? (
        <Spinner label="Loading orders…" />
      ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
        <EmptyState icon="package" title="No orders yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {ordersQuery.data.map((order) => {
            const badge = ESCROW_BADGE[order.escrowStatus];
            return (
              <div key={order.id} className="card p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-secondary">{order.id}</span>
                  <span className={badge.classes}>{badge.label}</span>
                </div>
                <p className="text-sm font-semibold text-ink">{order.listingTitle}</p>
                <div className="mt-1 text-xs text-ink-secondary">
                  {order.buyerName} → {order.sellerName}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-2 text-xs text-ink-secondary">
                  <span>{formatDateTime(order.createdAt)}</span>
                  <span className="text-sm font-bold text-primary">{formatSZL(order.total)}</span>
                </div>
                {order.withheldReason && (
                  <p className="mt-2 rounded-lg bg-ink p-2 text-[11px] text-white">
                    {order.withheldReason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
