import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getListing, placeOrder } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { Header } from '../../components/layout/Header';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { cx, formatSZL } from '../../lib/utils';
import type { PaymentMethod } from '../../types';

export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { items, clear } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mtn_momo');
  const [error, setError] = useState('');

  const listingsQuery = useQuery({
    queryKey: ['checkout-listings', items.map((i) => i.listingId).join(',')],
    queryFn: async () => {
      const results = await Promise.all(items.map((i) => getListing(i.listingId)));
      return results.filter(Boolean);
    },
    enabled: items.length > 0,
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      const orders = [];
      for (const item of items) {
        const order = await placeOrder({
          listingId: item.listingId,
          quantity: item.quantity,
          paymentMethod,
        });
        orders.push(order);
      }
      return orders;
    },
    onSuccess: (orders) => {
      clear();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${orders[0].id}?paid=1`);
    },
    onError: (err: Error) => setError(err.message),
  });

  useEffect(() => {
    if (!user) navigate('/login');
    else if (items.length === 0) navigate('/cart');
  }, [user, items.length, navigate]);

  if (!user || items.length === 0) return null;

  const listings = listingsQuery.data ?? [];
  const total = listings.reduce((sum, listing, idx) => {
    const item = items[idx];
    return sum + (listing ? listing.price * item.quantity : 0);
  }, 0);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header title="Checkout" onBack={() => navigate('/cart')} />

      <main className="flex-1 px-4 py-4">
        {listingsQuery.isLoading ? (
          <Spinner label="Preparing checkout…" />
        ) : (
          <div className="flex flex-col gap-4">
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">Order summary</h2>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => {
                  const listing = listings[idx];
                  if (!listing) return null;
                  return (
                    <div key={item.listingId} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {listing.title} <span className="text-ink-secondary">× {item.quantity}</span>
                      </span>
                      <span className="ml-3 shrink-0 font-semibold text-ink">
                        {formatSZL(listing.price * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-surface-border pt-3">
                <span className="text-base font-bold text-ink">Total</span>
                <span className="text-lg font-extrabold text-primary">{formatSZL(total)}</span>
              </div>
            </section>

            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">Payment method</h2>
              <div className="flex flex-col gap-3">
                <PaymentOption
                  icon="mobile"
                  label="MTN MoMo"
                  desc="Pay with your MTN mobile money wallet"
                  selected={paymentMethod === 'mtn_momo'}
                  onSelect={() => setPaymentMethod('mtn_momo')}
                />
                <PaymentOption
                  icon="card"
                  label="DPO Pay"
                  desc="Pay with your credit or debit card"
                  selected={paymentMethod === 'dpo_pay'}
                  onSelect={() => setPaymentMethod('dpo_pay')}
                />
              </div>
            </section>

            <section className="card flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
              <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-primary-800">
                Funds are held in escrow until you confirm receipt. The seller is paid only after you confirm,
                minus a 10% platform commission.
              </p>
            </section>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => {
                setError('');
                orderMutation.mutate();
              }}
              disabled={orderMutation.isPending}
              className="btn-primary w-full"
            >
              {orderMutation.isPending ? 'Processing payment…' : `Pay ${formatSZL(total)}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function PaymentOption({
  icon,
  label,
  desc,
  selected,
  onSelect,
}: {
  icon: string;
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cx(
        'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition active:scale-[0.99]',
        selected ? 'border-primary bg-primary-50' : 'border-surface-border bg-white hover:border-primary-200',
      )}
    >
      <div
        className={cx(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          selected ? 'bg-primary text-white' : 'bg-surface text-ink-secondary',
        )}
      >
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="text-xs text-ink-secondary">{desc}</p>
      </div>
      <div
        className={cx(
          'flex h-5 w-5 items-center justify-center rounded-full border-2',
          selected ? 'border-primary bg-primary' : 'border-surface-border',
        )}
      >
        {selected && <Icon name="check" size={12} className="text-white" />}
      </div>
    </button>
  );
}
