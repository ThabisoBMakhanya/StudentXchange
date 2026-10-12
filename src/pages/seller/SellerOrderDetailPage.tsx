import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrder, markShipped } from '../../lib/api';
import { Header } from '../../components/layout/Header';
import { SellerModeBar } from '../../components/layout/SellerModeBar';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatDateTime, formatSZL } from '../../lib/utils';

export function SellerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shipError, setShipError] = useState('');

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const shipMutation = useMutation({
    mutationFn: () => markShipped(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => setShipError(err.message),
  });

  if (orderQuery.isLoading) return <Spinner fullScreen label="Loading order…" />;
  const order = orderQuery.data;
  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <SellerModeBar />
        <Header title="Order not found" onBack={() => navigate('/seller/orders')} />
      </div>
    );
  }

  const badge = ESCROW_BADGE[order.escrowStatus];
  const canShip = order.escrowStatus === 'held' && order.listingType === 'physical' && !order.shippedAt;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SellerModeBar />
      <Header title={order.id} onBack={() => navigate('/seller/orders')} />

      <main className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Escrow status</h2>
              <span className={badge.classes}>{badge.label}</span>
            </div>
            {order.withheldReason && (
              <div className="rounded-xl bg-ink p-3 text-white">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Icon name="alert" size={14} /> Admin has withheld these funds
                </p>
                <p className="mt-1 text-xs opacity-90">{order.withheldReason}</p>
              </div>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Order</h2>
            <p className="text-sm font-semibold text-ink">{order.listingTitle}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Buyer" value={order.buyerName} />
              <Row label="Quantity" value={String(order.quantity)} />
              <Row label="Payment" value={order.paymentMethod === 'mtn_momo' ? 'MTN MoMo' : 'DPO Pay (Card)'} />
              <Row label="Ordered" value={formatDateTime(order.createdAt)} />
              {order.trackingCode && <Row label="Tracking code" value={order.trackingCode} />}
              {order.shippedAt && <Row label="Shipped" value={formatDateTime(order.shippedAt)} />}
              {order.confirmedAt && <Row label="Buyer confirmed" value={formatDateTime(order.confirmedAt)} />}
            </div>
            <div className="mt-3 border-t border-surface-border pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-secondary">Order total</span>
                <span className="font-semibold text-ink">{formatSZL(order.total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-ink-secondary">Platform commission (10%)</span>
                <span className="font-semibold text-ink">−{formatSZL(order.commission)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-2">
                <span className="text-sm font-bold text-ink">You receive</span>
                <span className="text-lg font-extrabold text-primary">
                  {formatSZL(order.total - order.commission)}
                </span>
              </div>
            </div>
          </section>

          {shipError && (
            <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{shipError}</span>
            </div>
          )}

          {canShip && (
            <button
              onClick={() => shipMutation.mutate()}
              disabled={shipMutation.isPending}
              className="btn-primary w-full"
            >
              <Icon name="truck" size={18} />
              {shipMutation.isPending ? 'Marking…' : 'Mark as shipped'}
            </button>
          )}

          {order.escrowStatus === 'held' && order.listingType === 'service' && (
            <div className="card flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
              <Icon name="info" size={20} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-primary-800">
                Deliver the service at the agreed time, then ask the buyer to confirm receipt. Funds release
                automatically once they confirm.
              </p>
            </div>
          )}

          {order.escrowStatus === 'released' && (
            <div className="card flex items-center gap-3 border-primary-100 bg-primary-50 p-4">
              <Icon name="check" size={22} className="shrink-0 text-primary-600" />
              <p className="text-sm font-semibold text-primary-800">
                Funds released — {formatSZL(order.total - order.commission)} is on its way to your payout balance.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
