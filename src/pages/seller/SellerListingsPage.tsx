import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSellerListings } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { AppShell } from '../../components/layout/AppShell';
import { Header } from '../../components/layout/Header';
import { ListingArt } from '../../components/marketplace/ListingArt';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { cx, formatSZL } from '../../lib/utils';
import { categoryIcon } from '../../lib/categoryIcons';
import { SELLER_NAV } from '../../lib/navigation';

export function SellerListingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const listingsQuery = useQuery({
    queryKey: ['listings', 'seller', user?.id],
    queryFn: () => getSellerListings(user!.id),
    enabled: !!user,
  });

  return (
    <AppShell nav={SELLER_NAV} sellerModeControls>
      <Header
        title="My Listings"
        subtitle="Physical items and services"
        right={
          <button
            onClick={() => navigate('/seller/listings/new')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-700 active:scale-95"
            aria-label="New listing"
          >
            <Icon name="plus" size={20} />
          </button>
        }
      />

      <main className="px-4 py-4">
        {listingsQuery.isLoading ? (
          <Spinner label="Loading listings…" />
        ) : !listingsQuery.data || listingsQuery.data.length === 0 ? (
          <EmptyState
            icon="tag"
            title="No listings yet"
            message="Create your first listing to start selling to students on campus."
            action={
              <button onClick={() => navigate('/seller/listings/new')} className="btn-primary">
                Create listing
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {listingsQuery.data.map((listing) => (
              <button
                key={listing.id}
                onClick={() => navigate(`/seller/listings/${listing.id}`)}
                className="card flex gap-3 overflow-hidden p-3 text-left transition hover:shadow-card-hover active:scale-[0.99]"
              >
                <ListingArt icon={categoryIcon(listing.categoryId)} images={listing.images} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Badge variant={listing.type === 'physical' ? 'info' : 'success'}>
                      {listing.type === 'physical' ? 'Item' : 'Service'}
                    </Badge>
                    <Badge variant={listing.status === 'active' ? 'success' : 'warning'}>
                      {listing.status === 'active' ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-ink">{listing.title}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{formatSZL(listing.price)}</span>
                    {listing.type === 'physical' ? (
                      <span className="text-xs text-ink-secondary">Stock: {listing.stock}</span>
                    ) : (
                      <span className="text-xs text-ink-secondary">
                        {listing.availabilitySlots?.length ?? 0} slots
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="chevronRight" size={18} className="self-center text-ink-secondary" />
              </button>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
