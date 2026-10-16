import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListings, getCategories } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { useRoleStore } from '../../stores/roleStore';
import { AppShell } from '../../components/layout/AppShell';
import { RoleSwitcher } from '../../components/layout/RoleSwitcher';
import { Header } from '../../components/layout/Header';
import { SearchBar } from '../../components/marketplace/SearchBar';
import { TypeTabs, type ListingTypeFilter } from '../../components/marketplace/TypeTabs';
import { CategoryGrid } from '../../components/marketplace/CategoryGrid';
import { ListingCard } from '../../components/marketplace/ListingCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../lib/utils';
import { CUSTOMER_NAV } from '../../lib/navigation';
import type { Category } from '../../types';

export function CustomerHomePage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<ListingTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const cartCount = useCartStore((s) => s.count());
  const mode = useRoleStore((s) => s.mode);

  const listingsQuery = useQuery({
    queryKey: ['listings', typeFilter, selectedCategory?.id, search],
    queryFn: () =>
      getListings({
        type: typeFilter === 'all' ? undefined : typeFilter,
        categoryId: selectedCategory?.id,
        search: search || undefined,
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', typeFilter],
    queryFn: () => getCategories(typeFilter === 'all' ? undefined : typeFilter),
  });

  const topCategories = (categoriesQuery.data ?? [])
    .filter((c) => c.parentId === null && c.active)

  return (
    <AppShell nav={CUSTOMER_NAV}>
      <Header
        title="StudentXchange"
        subtitle="Buy & sell on campus"
        right={
          <button
            onClick={() => navigate('/cart')}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink transition hover:bg-surface active:scale-95"
            aria-label="Cart"
          >
            <Icon name="cart" size={22} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        }
      />
      <RoleSwitcher />

      <main className="flex flex-col gap-5 px-4 py-4">
        <SearchBar value={search} onChange={setSearch} />

        <TypeTabs
          value={typeFilter}
          onChange={(nextType) => {
            setTypeFilter(nextType);
            setSelectedCategory(null);
          }}
        />

        {!selectedCategory && !search && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Categories</h2>
              <span className="text-xs text-ink-secondary">
                {typeFilter === 'all' ? 'Items and services' : typeFilter === 'physical' ? 'Physical items' : 'Services'}
              </span>
            </div>
            {categoriesQuery.isLoading ? (
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-20" />
                ))}
              </div>
            ) : (
              <CategoryGrid categories={topCategories} onSelect={setSelectedCategory} />
            )}
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              {selectedCategory ? selectedCategory.name : search ? 'Search results' : 'Recent listings'}
            </h2>
            {(selectedCategory || search) && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSearch('');
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {listingsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-52" />
              ))}
            </div>
          ) : listingsQuery.data && listingsQuery.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {listingsQuery.data.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="search"
              title="Nothing found"
              message="Try a different search or browse the categories above."
            />
          )}
        </section>
      </main>
    </AppShell>
  );
}
