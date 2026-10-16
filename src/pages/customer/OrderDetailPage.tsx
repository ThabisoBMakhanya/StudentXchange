import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmReceipt, getOrder, raiseDispute } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Header } from '../../components/layout/Header';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { ESCROW_BADGE, formatDateTime, formatSZL } from '../../lib/utils';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmReceipt(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: Error) => setConfirmError(err.message),
  });

  const disputeMutation = useMutation({
    mutationFn: () => raiseDispute(id!, user!.id, disputeReason, disputeDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowDispute(false);
    },
  });

  const momoRef = searchParams.get('momo_ref');
  const { data: momoStatus } = useQuery({
    queryKey: ['momo-status', momoRef],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/payments/momo/status/${momoRef}`,
      );
      return res.json();
    },
    enabled: !!momoRef,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'SUCCESSFUL' || status === 'FAILED') return false;
      return 5000;
    },
  });

  useEffect(() => {
    if (momoStatus?.status === 'SUCCESSFUL') {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  }, [momoStatus, queryClient, id]);

  if (orderQuery.isLoading) return <Spinner fullScreen label="Loading order…" />;
  const order = orderQuery.data;
  if (!order) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header title="Order not found" onBack={() => navigate('/orders')} />
      </div>
    );
  }

  const badge = ESCROW_BADGE[order.escrowStatus];
  const justPaid = searchParams.get('paid') === '1';

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header title={order.id} onBack={() => navigate('/orders')} />

      <main className="flex-1 px-4 py-4">
        {justPaid && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl bg-primary-600 p-4 text-white">
            <Icon name="check" size={22} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Payment successful</p>
              <p className="mt-0.5 text-xs opacity-90">
                {formatSZL(order.total)} is now held in escrow. The seller has been notified.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Escrow status</h2>
              <span className={badge.classes}>{badge.label}</span>
            </div>
            <EscrowTimeline status={order.escrowStatus} />
            {order.withheldReason && (
              <div className="mt-3 rounded-xl bg-ink p-3 text-white">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Icon name="alert" size={14} /> Admin withholding notice
                </p>
                <p className="mt-1 text-xs opacity-90">{order.withheldReason}</p>
              </div>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Order details</h2>
            <p className="text-sm font-semibold text-ink">{order.listingTitle}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Seller" value={order.sellerName} />
              <Row label="Quantity" value={String(order.quantity)} />
              <Row label="Payment method" value={order.paymentMethod === 'mtn_momo' ? 'MTN MoMo' : 'DPO Pay (Card)'} />
              <Row label="Ordered" value={formatDateTime(order.createdAt)} />
              {order.trackingCode && <Row label="Tracking code" value={order.trackingCode} />}
              {order.shippedAt && <Row label="Shipped" value={formatDateTime(order.shippedAt)} />}
              {order.deliveredAt && <Row label="Delivered" value={formatDateTime(order.deliveredAt)} />}
              {order.confirmedAt && <Row label="Confirmed" value={formatDateTime(order.confirmedAt)} />}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
              <span className="text-sm font-bold text-ink">Total paid</span>
              <span className="text-lg font-extrabold text-primary">{formatSZL(order.total)}</span>
            </div>
          </section>

          {confirmError && (
            <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{confirmError}</span>
            </div>
          )}

          {order.escrowStatus === 'held' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                className="btn-primary w-full"
              >
                <Icon name="check" size={18} />
                {confirmMutation.isPending ? 'Confirming…' : 'Confirm receipt — release funds to seller'}
              </button>
              <button onClick={() => setShowDispute(true)} className="btn-secondary w-full">
                <Icon name="alert" size={18} />
                Report a problem / raise dispute
              </button>
            </div>
          )}

          {order.escrowStatus === 'disputed' && (
            <div className="card flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
              <Icon name="info" size={20} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-primary-800">
                Your dispute is open. An admin will review it and may withhold, release, split, or refund the
                escrowed funds.
              </p>
            </div>
          )}
        </div>
      </main>

      {showDispute && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={() => setShowDispute(false)}>
          <div
            className="safe-bottom w-full max-w-lg rounded-t-3xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink">Raise a dispute</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              This freezes the escrow and notifies the admin. Describe what went wrong.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <select
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select a reason…</option>
                <option>Item not as described</option>
                <option>Item not received</option>
                <option>Service not delivered</option>
                <option>Seller unresponsive</option>
                <option>Suspected fraud</option>
                <option>Other</option>
              </select>
              <textarea
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
                placeholder="Tell us what happened…"
                rows={4}
                className="input-field resize-none"
              />
              <button
                onClick={() => disputeMutation.mutate()}
                disabled={!disputeReason || disputeMutation.isPending}
                className="btn-primary w-full"
              >
                {disputeMutation.isPending ? 'Submitting…' : 'Submit dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function EscrowTimeline({ status }: { status: string }) {
  const steps = [
    { key: 'pending_payment', label: 'Payment', icon: 'card' },
    { key: 'held', label: 'In escrow', icon: 'shield' },
    { key: 'released', label: 'Released', icon: 'check' },
  ];
  const withheld = status === 'withheld_by_admin' || status === 'disputed';
  const activeIdx = withheld ? 1 : status === 'released' ? 2 : status === 'held' ? 1 : 0;

  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const done = idx < activeIdx || status === 'released';
        const current = idx === activeIdx && !withheld;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  done
                    ? 'border-primary bg-primary text-white'
                    : current
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-surface-border bg-white text-ink-secondary'
                }`}
              >
                <Icon name={step.icon} size={16} />
              </div>
              <span className={`text-[10px] font-semibold ${done || current ? 'text-primary' : 'text-ink-secondary'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`mx-2 mb-4 h-0.5 flex-1 rounded ${idx < activeIdx ? 'bg-primary' : 'bg-surface-border'}`} />
            )}
          </div>
        );
      })}
      {withheld && (
        <div className="ml-3 flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[10px] font-bold text-white">
          <Icon name="alert" size={12} /> FROZEN
        </div>
      )}
    </div>
  );
}
