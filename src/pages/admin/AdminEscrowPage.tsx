import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminRefundBuyer,
  adminReleaseFunds,
  adminSplitFunds,
  adminWithholdFunds,
  getAllOrders,
} from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatDateTime, formatSZL } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { Order } from '../../types';

/**
 * Escrow Control Panel — the admin override surface.
 * Admins can withhold funds at any point, then release, refund, or split.
 * Every action is written to the audit log with timestamp and reason.
 */
export function AdminEscrowPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<'all' | 'held' | 'withheld_by_admin' | 'disputed'>('all');

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: getAllOrders,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order'] });
  };

  const withholdMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      adminWithholdFunds(adminId, orderId, reason),
    onSuccess: () => {
      invalidate();
      setSelectedOrder(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (orderId: string) => adminReleaseFunds(adminId, orderId),
    onSuccess: () => {
      invalidate();
      setSelectedOrder(null);
    },
  });

  const refundMutation = useMutation({
    mutationFn: (orderId: string) => adminRefundBuyer(adminId, orderId),
    onSuccess: () => {
      invalidate();
      setSelectedOrder(null);
    },
  });

  const splitMutation = useMutation({
    mutationFn: ({ orderId, pct }: { orderId: string; pct: number }) =>
      adminSplitFunds(adminId, orderId, pct),
    onSuccess: () => {
      invalidate();
      setSelectedOrder(null);
    },
  });

  const orders = (ordersQuery.data ?? []).filter((o) => {
    if (filter === 'all') return o.escrowStatus !== 'released' && o.escrowStatus !== 'refunded' && o.escrowStatus !== 'split';
    return o.escrowStatus === filter;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Escrow Control Panel</h2>
        <p className="text-xs text-ink-secondary">
          Manually hold, release, refund, or split funds. All actions are audit-logged.
        </p>
      </div>

      <div className="flex gap-2">
        {(['all', 'held', 'withheld_by_admin', 'disputed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`min-h-tap rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition active:scale-95 ${
              filter === f ? 'bg-primary text-white' : 'bg-white text-ink-secondary border border-surface-border hover:text-primary'
            }`}
          >
            {f === 'withheld_by_admin' ? 'Withheld' : f}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <Spinner label="Loading orders…" />
      ) : orders.length === 0 ? (
        <EmptyState icon="shield" title="No orders here" message="Orders matching this filter will appear for escrow control." />
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((order) => {
            const badge = ESCROW_BADGE[order.escrowStatus];
            return (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="card p-4 text-left transition hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-secondary">{order.id}</span>
                  <span className={badge.classes}>{badge.label}</span>
                </div>
                <p className="line-clamp-1 text-sm font-semibold text-ink">{order.listingTitle}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-secondary">
                  <span>{order.buyerName} → {order.sellerName}</span>
                  <span className="text-sm font-bold text-primary">{formatSZL(order.total)}</span>
                </div>
                {order.withheldReason && (
                  <p className="mt-2 line-clamp-2 rounded-lg bg-surface p-2 text-[11px] text-ink-secondary">
                    {order.withheldReason}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <EscrowActionSheet
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onWithhold={(reason) => withholdMutation.mutate({ orderId: selectedOrder.id, reason })}
          onRelease={() => releaseMutation.mutate(selectedOrder.id)}
          onRefund={() => refundMutation.mutate(selectedOrder.id)}
          onSplit={(pct) => splitMutation.mutate({ orderId: selectedOrder.id, pct })}
          pending={
            withholdMutation.isPending ||
            releaseMutation.isPending ||
            refundMutation.isPending ||
            splitMutation.isPending
          }
        />
      )}
    </div>
  );
}

function EscrowActionSheet({
  order,
  onClose,
  onWithhold,
  onRelease,
  onRefund,
  onSplit,
  pending,
}: {
  order: Order;
  onClose: () => void;
  onWithhold: (reason: string) => void;
  onRelease: () => void;
  onRefund: () => void;
  onSplit: (buyerPercent: number) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [splitPct, setSplitPct] = useState(50);
  const badge = ESCROW_BADGE[order.escrowStatus];
  const canWithhold = order.escrowStatus !== 'released' && order.escrowStatus !== 'refunded' && order.escrowStatus !== 'split';
  const canAct = order.escrowStatus === 'held' || order.escrowStatus === 'withheld_by_admin' || order.escrowStatus === 'disputed';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={onClose}>
      <div
        className="safe-bottom max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />

        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-secondary">{order.id}</span>
          <span className={badge.classes}>{badge.label}</span>
        </div>
        <h2 className="text-lg font-bold text-ink">{order.listingTitle}</h2>
        <p className="mt-0.5 text-sm text-ink-secondary">
          {order.buyerName} → {order.sellerName} · {formatSZL(order.total)} in escrow
        </p>

        {order.withheldReason && (
          <div className="mt-3 rounded-xl bg-ink p-3 text-white">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Icon name="alert" size={14} /> Currently withheld
            </p>
            <p className="mt-1 text-xs opacity-90">{order.withheldReason}</p>
            <p className="mt-1 text-[10px] opacity-60">
              Since {order.withheldAt ? formatDateTime(order.withheldAt) : 'unknown'}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {canWithhold && (
            <div className="rounded-2xl border border-surface-border p-4">
              <label className="mb-2 block text-sm font-bold text-ink">
                <Icon name="alert" size={14} className="mr-1 inline" />
                Withhold funds
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Reason (e.g. suspected fraud, buyer complaint, KYC issue)…"
                className="input-field resize-none text-sm"
              />
              <button
                onClick={() => reason.trim() && onWithhold(reason.trim())}
                disabled={!reason.trim() || pending}
                className="mt-3 min-h-tap w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                Freeze funds in escrow
              </button>
            </div>
          )}

          {canAct && (
            <>
              <button
                onClick={onRelease}
                disabled={pending}
                className="btn-primary w-full"
              >
                <Icon name="check" size={18} />
                Release to seller ({formatSZL(order.total - order.commission)})
              </button>
              <button
                onClick={onRefund}
                disabled={pending}
                className="btn-secondary w-full"
              >
                <Icon name="refresh" size={18} />
                Refund buyer ({formatSZL(order.total)})
              </button>
              <div className="rounded-2xl border border-surface-border p-4">
                <p className="mb-3 text-sm font-bold text-ink">Split funds</p>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                  <span className="text-primary">Buyer {splitPct}%</span>
                  <span className="text-ink-secondary">Seller {100 - splitPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  className="w-full accent-[#0A3D91]"
                />
                <button
                  onClick={() => onSplit(splitPct)}
                  disabled={pending}
                  className="btn-secondary mt-3 w-full"
                >
                  Split {formatSZL((order.total * splitPct) / 100)} / {formatSZL(order.total - (order.total * splitPct) / 100)}
                </button>
              </div>
            </>
          )}

          {!canWithhold && !canAct && (
            <div className="rounded-2xl bg-surface p-4 text-center">
              <Icon name="check" size={24} className="mx-auto text-primary" />
              <p className="mt-2 text-sm font-semibold text-ink">Funds already settled</p>
              <p className="text-xs text-ink-secondary">This escrow cycle is complete.</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="min-h-tap w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:bg-surface active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
