import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getListing, placeOrder } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { Header } from '../../components/layout/Header';
import { ListingArt } from '../../components/marketplace/ListingArt';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatSZL } from '../../lib/utils';
import { categoryIcon } from '../../lib/categoryIcons';

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const listingQuery = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  const orderMutation = useMutation({
    mutationFn: () =>
      placeOrder({
        listingId: id!,
        quantity,
        paymentMethod: 'mtn_momo',
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}?paid=1`);
    },
  });

  if (listingQuery.isLoading) return <Spinner fullScreen label="Loading listing…" />;
  const listing = listingQuery.data;
  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header title="Not found" onBack={() => navigate(-1)} />
        <div className="p-8 text-center text-ink-secondary">This listing no longer exists.</div>
      </div>
    );
  }

  const maxQty = listing.type === 'physical' ? listing.stock ?? 1 : 1;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Header title={listing.type === 'physical' ? 'Item details' : 'Service details'} onBack={() => navigate(-1)} />

      <main className="flex-1">
        <ListingArt icon={categoryIcon(listing.categoryId)} images={listing.images} size="lg" className="rounded-none" />

        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={listing.type === 'physical' ? 'info' : 'success'}>
                {listing.type === 'physical' ? 'Physical item' : 'Service'}
              </Badge>
              {listing.escrowStatus === 'withheld_by_admin' && <Badge variant="error">Escrow withheld</Badge>}
            </div>
            <h1 className="text-xl font-bold leading-snug text-ink">{listing.title}</h1>
            <p className="mt-1 text-2xl font-extrabold text-primary">{formatSZL(listing.price)}</p>
          </div>

          <div className="card flex items-center gap-3 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary">
              <Icon name="store" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{listing.sellerName}</p>
              <p className="flex items-center gap-1 text-xs text-ink-secondary">
                <Icon name="location" size={12} /> {listing.location}
              </p>
            </div>
            <Badge variant="success">Escrow protected</Badge>
          </div>

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">Description</h2>
            <p className="text-sm leading-relaxed text-ink-secondary">{listing.description}</p>
          </section>

          {listing.type === 'physical' ? (
            <section className="card flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-bold text-ink">Condition</p>
                <p className="text-sm capitalize text-ink-secondary">{listing.condition?.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-ink">Stock</p>
                <p className="text-sm text-ink-secondary">{listing.stock} available</p>
              </div>
            </section>
          ) : (
            <section className="card p-4">
              <h2 className="mb-2 text-sm font-bold text-ink">Availability</h2>
              <div className="flex flex-wrap gap-2">
                {listing.availabilitySlots?.map((slot) => (
                  <span key={slot} className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary">
                    {slot}
                  </span>
                ))}
              </div>
              {listing.durationMinutes && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-secondary">
                  <Icon name="clock" size={14} />
                  {listing.durationMinutes >= 60
                    ? `${listing.durationMinutes / 60} hour session`
                    : `${listing.durationMinutes} minute session`}
                </p>
              )}
            </section>
          )}

          <section className="card flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
            <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-primary-800">
              Your payment is held in escrow by StudentXchange and only released to the seller after you confirm
              receipt. An admin can withhold funds if a problem is reported.
            </p>
          </section>
        </div>
      </main>

      <div className="safe-bottom sticky bottom-0 border-t border-surface-border bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {listing.type === 'physical' && (
            <div className="flex items-center rounded-xl border border-surface-border">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center text-ink transition hover:bg-surface active:scale-95"
                aria-label="Decrease quantity"
              >
                <Icon name="minus" size={18} />
              </button>
              <span className="w-8 text-center text-base font-bold text-ink">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                className="flex h-11 w-11 items-center justify-center text-ink transition hover:bg-surface active:scale-95"
                aria-label="Increase quantity"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          )}
          <button
            onClick={() => {
              addItem(listing.id, quantity);
              setAdded(true);
              setTimeout(() => setAdded(false), 1500);
            }}
            className="btn-secondary flex-1"
          >
            <Icon name="cart" size={18} />
            {added ? 'Added to cart' : 'Add to cart'}
          </button>
          <button
            onClick={() => {
              if (!user) {
                navigate('/login');
                return;
              }
              orderMutation.mutate();
            }}
            disabled={orderMutation.isPending}
            className="btn-primary flex-1"
          >
            {orderMutation.isPending ? 'Processing…' : 'Buy now'}
          </button>
        </div>
      </div>
    </div>
  );
}
