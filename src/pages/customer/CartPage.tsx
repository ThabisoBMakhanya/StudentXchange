import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListing } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { ListingArt } from '../../components/marketplace/ListingArt';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatSZL } from '../../lib/utils';
import { CUSTOMER_NAV } from '../../lib/navigation';

export function CartPage() {
  const navigate = useNavigate();
  const { items, setQuantity, removeItem } = useCartStore();

  const listingsQuery = useQuery({
    queryKey: ['cart-listings', items.map((i) => i.listingId).join(',')],
    queryFn: async () => {
      const results = await Promise.all(items.map((i) => getListing(i.listingId)));
      return results.filter(Boolean);
    },
    enabled: items.length > 0,
  });

  const total = (listingsQuery.data ?? []).reduce((sum, listing, idx) => {
    const item = items[idx];
    return sum + (listing ? listing.price * item.quantity : 0);
  }, 0);

  return (
    <AppShell nav={CUSTOMER_NAV}>
      <Header title="Cart" subtitle={`${items.length} item${items.length === 1 ? '' : 's'}`} />

      <main className="px-4 py-4">
        {items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="Your cart is empty"
            message="Browse the marketplace and add items or services you need."
            action={
              <button onClick={() => navigate('/')} className="btn-primary">
                Browse listings
              </button>
            }
          />
        ) : listingsQuery.isLoading ? (
          <Spinner label="Loading cart…" />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item, idx) => {
              const listing = listingsQuery.data?.[idx];
              if (!listing) return null;
              return (
                <div key={item.listingId} className="card flex gap-3 p-3">
                  <ListingArt icon="grid" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{listing.title}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">{formatSZL(listing.price)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-surface-border">
                        <button
                          onClick={() => setQuantity(item.listingId, item.quantity - 1)}
                          className="flex h-9 w-9 items-center justify-center text-ink transition hover:bg-surface active:scale-95"
                          aria-label="Decrease"
                        >
                          <Icon name="minus" size={16} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-ink">{item.quantity}</span>
                        <button
                          onClick={() => setQuantity(item.listingId, item.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center text-ink transition hover:bg-surface active:scale-95"
                          aria-label="Increase"
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-ink active:scale-95"
                        aria-label="Remove"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="card mt-2 p-4">
              <div className="mb-1 flex items-center justify-between text-sm text-ink-secondary">
                <span>Subtotal</span>
                <span className="font-semibold text-ink">{formatSZL(total)}</span>
              </div>
              <div className="mb-3 flex items-center justify-between text-sm text-ink-secondary">
                <span>Escrow protection</span>
                <span className="font-semibold text-primary-600">Included</span>
              </div>
              <div className="flex items-center justify-between border-t border-surface-border pt-3">
                <span className="text-base font-bold text-ink">Total</span>
                <span className="text-lg font-extrabold text-primary">{formatSZL(total)}</span>
              </div>
            </div>

            <button onClick={() => navigate('/checkout')} className="btn-primary w-full">
              Proceed to checkout
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
