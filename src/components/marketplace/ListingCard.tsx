import { useNavigate } from 'react-router-dom';
import type { Listing } from '../../types';
import { formatSZL } from '../../lib/utils';
import { categoryIcon } from '../../lib/categoryIcons';
import { ListingArt } from './ListingArt';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';

export function ListingCard({ listing }: { listing: Listing }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="card group overflow-hidden text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]"
    >
      <div className="relative">
        <ListingArt icon={categoryIcon(listing.categoryId)} images={listing.images} />
        <span className="absolute left-2 top-2">
          <Badge variant={listing.type === 'physical' ? 'info' : 'success'}>
            {listing.type === 'physical' ? 'Item' : 'Service'}
          </Badge>
        </span>
        {listing.escrowStatus === 'withheld_by_admin' && (
          <span className="absolute right-2 top-2">
            <Badge variant="error">Withheld</Badge>
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold leading-snug text-ink group-hover:text-primary">
          {listing.title}
        </h3>
        <p className="mt-1 text-base font-bold text-primary">{formatSZL(listing.price)}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 truncate text-xs text-ink-secondary">
            <Icon name="location" size={12} />
            <span className="max-w-[110px] truncate">{listing.location}</span>
          </span>
          {listing.type === 'physical' ? (
            <span className="text-right text-[11px] text-ink-secondary">
              {listing.stock !== undefined && listing.stock > 0
                ? `${listing.stock} in stock`
                : 'Out of stock'}
            </span>
          ) : (
            <span className="text-right text-[11px] text-ink-secondary">
              {listing.durationMinutes !== undefined && (
                <>{listing.durationMinutes >= 60 ? `${listing.durationMinutes / 60}h` : `${listing.durationMinutes}m`} session</>
              )}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
