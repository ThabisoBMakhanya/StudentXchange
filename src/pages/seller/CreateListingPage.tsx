import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createListing, getCategories } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Header } from '../../components/layout/Header';
import { SellerModeBar } from '../../components/layout/SellerModeBar';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../lib/utils';
import type { ListingType } from '../../types';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 750 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function CreateListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState<ListingType>('physical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [stock, setStock] = useState('1');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair'>('good');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [availability, setAvailability] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['categories', type],
    queryFn: () => getCategories(type),
  });

  const leafCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.parentId !== null && c.active,
  );

  const mutation = useMutation({
    mutationFn: () =>
      createListing(user!.id, {
        type,
        title,
        description,
        price: Number(price),
        categoryId,
        location,
        stock: type === 'physical' ? Number(stock) : undefined,
        condition: type === 'physical' ? condition : undefined,
        durationMinutes: type === 'service' ? Number(durationMinutes) : undefined,
        availabilitySlots: type === 'service'
          ? availability.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        images,
      }),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      navigate(`/seller/listings/${listing.id}?created=1`);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SellerModeBar />
      <Header title="Create listing" onBack={() => navigate(-1)} />

      <main className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-ink">Listing type</h2>
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                icon="package"
                label="Physical item"
                desc="Goods with stock"
                selected={type === 'physical'}
                onSelect={() => {
                  setType('physical');
                  setCategoryId('');
                }}
              />
              <TypeCard
                icon="zap"
                label="Service"
                desc="Bookable sessions"
                selected={type === 'service'}
                onSelect={() => {
                  setType('service');
                  setCategoryId('');
                }}
              />
            </div>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (!categoryId) {
                setError('Please choose a category.');
                return;
              }
              mutation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <section className="card flex flex-col gap-3 p-4">
              <h2 className="text-sm font-bold text-ink">Details</h2>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} placeholder="e.g. MacBook Air M1 — excellent condition" className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Condition, what is included, reason for selling…" className="input-field resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Price (SZL)</label>
                  <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="500" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="UNISWA Kwaluseni" className="input-field" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="input-field">
                  <option value="">Choose a category…</option>
                  {leafCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="card flex flex-col gap-3 p-4">
              <div>
                <h2 className="text-sm font-bold text-ink">Photos</h2>
                <p className="mt-1 text-xs text-ink-secondary">Up to 3 JPG, PNG, or WebP images; 750 KB each.</p>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border px-3 py-2 text-sm font-semibold text-primary hover:border-primary">
                <Icon name="camera" size={18} />
                Add photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={async (event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = '';
                    if (images.length + files.length > MAX_IMAGES) {
                      setError(`You can add up to ${MAX_IMAGES} photos.`);
                      return;
                    }
                    try {
                      const encoded = await Promise.all(files.map(readListingImage));
                      setImages((current) => [...current, ...encoded]);
                      setError('');
                    } catch (imageError) {
                      setError(imageError instanceof Error ? imageError.message : 'Could not read the selected image.');
                    }
                  }}
                />
              </label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((image, index) => (
                    <div key={`${index}-${image.length}`} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
                      <img src={image} alt={`Listing photo ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-white"
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {type === 'physical' ? (
              <section className="card flex flex-col gap-3 p-4">
                <h2 className="text-sm font-bold text-ink">Item specifics</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Stock</label>
                    <input type="number" min="1" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Condition</label>
                    <select value={condition} onChange={(e) => setCondition(e.target.value as 'new' | 'like_new' | 'good' | 'fair')} className="input-field">
                      <option value="new">New</option>
                      <option value="like_new">Like new</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>
                </div>
              </section>
            ) : (
              <section className="card flex flex-col gap-3 p-4">
                <h2 className="text-sm font-bold text-ink">Service specifics</h2>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Session duration (minutes)</label>
                  <input type="number" min="15" step="15" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Availability slots</label>
                  <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Mon 14:00, Wed 16:00, Sat 10:00" className="input-field" />
                  <p className="mt-1 text-xs text-ink-secondary">Comma-separated time slots</p>
                </div>
              </section>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
              {mutation.isPending ? 'Publishing…' : 'Publish listing'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function readListingImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return Promise.reject(new Error('Choose a JPG, PNG, or WebP image.'));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error('Each photo must be 750 KB or smaller.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the selected image.'));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function TypeCard({
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
      type="button"
      onClick={onSelect}
      className={cx(
        'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition active:scale-[0.98]',
        selected ? 'border-primary bg-primary-50' : 'border-surface-border bg-white hover:border-primary-200',
      )}
    >
      <Icon name={icon} size={20} className={selected ? 'text-primary' : 'text-ink-secondary'} />
      <span className="text-sm font-bold text-ink">{label}</span>
      <span className="text-xs text-ink-secondary">{desc}</span>
    </button>
  );
}
