import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategory, getCategories, saveCategory } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { cx } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { Category, ListingType } from '../../types';

export function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');
  const [tree, setTree] = useState<ListingType>('physical');
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories', tree],
    queryFn: () => getCategories(tree),
  });

  const saveMutation = useMutation({
    mutationFn: (cat: Omit<Category, 'id'> & { id?: string }) => saveCategory(adminId, cat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(adminId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const categories = categoriesQuery.data ?? [];
  const roots = categories.filter((c) => c.parentId === null);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-ink">Category Management</h2>
          <p className="text-xs text-ink-secondary">Separate trees for physical items and services</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-700 active:scale-95"
          aria-label="Add category"
        >
          <Icon name="plus" size={20} />
        </button>
      </div>

      <div className="flex rounded-xl border border-surface-border bg-surface p-1">
        {(['physical', 'service'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTree(t)}
            className={cx(
              'min-h-tap flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition active:scale-[0.98]',
              tree === t ? 'bg-primary text-white shadow-card' : 'text-ink-secondary hover:text-ink',
            )}
          >
            {t === 'physical' ? 'Physical items' : 'Services'}
          </button>
        ))}
      </div>

      {categoriesQuery.isLoading ? (
        <Spinner label="Loading categories…" />
      ) : (
        <div className="flex flex-col gap-3">
          {roots.map((root) => (
            <div key={root.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-surface-border bg-surface p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                  <Icon name={root.icon} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{root.name}</p>
                  <p className="truncate text-xs text-ink-secondary">{root.description}</p>
                </div>
                <Badge variant={root.active ? 'success' : 'warning'}>
                  {root.active ? 'Active' : 'Inactive'}
                </Badge>
                <button
                  onClick={() => {
                    setEditing(root);
                    setShowForm(true);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-white hover:text-primary active:scale-95"
                  aria-label={`Edit ${root.name}`}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(root.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-white hover:text-ink active:scale-95"
                  aria-label={`Delete ${root.name}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              {childrenOf(root.id).length > 0 && (
                <div className="flex flex-col">
                  {childrenOf(root.id).map((child) => (
                    <div key={child.id} className="flex items-center gap-3 border-b border-surface-border px-4 py-2.5 last:border-0">
                      <Icon name="chevronRight" size={14} className="text-ink-secondary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{child.name}</p>
                      </div>
                      <Badge variant={child.active ? 'success' : 'warning'}>
                        {child.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <button
                        onClick={() => {
                          setEditing(child);
                          setShowForm(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-primary active:scale-95"
                        aria-label={`Edit ${child.name}`}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(child.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-ink active:scale-95"
                        aria-label={`Delete ${child.name}`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CategoryForm
          key={editing?.id ?? 'new'}
          type={tree}
          editing={editing}
          categories={categories}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={(cat) => saveMutation.mutate(cat)}
          pending={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function CategoryForm({
  type,
  editing,
  categories,
  onClose,
  onSave,
  pending,
}: {
  type: ListingType;
  editing: Category | null;
  categories: Category[];
  onClose: () => void;
  onSave: (cat: Omit<Category, 'id'> & { id?: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [parentId, setParentId] = useState<string>(editing?.parentId ?? '');
  const [active, setActive] = useState(editing?.active ?? true);

  const roots = categories.filter((c) => c.parentId === null && c.id !== editing?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={onClose}>
      <div className="safe-bottom w-full max-w-lg rounded-t-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
        <h2 className="text-lg font-bold text-ink">{editing ? 'Edit category' : 'New category'}</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="input-field" placeholder="e.g. Calculators" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Short description" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">Parent (optional — leave empty for top level)</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input-field">
              <option value="">Top level</option>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <label className="flex min-h-tap items-center gap-3 rounded-xl border border-surface-border p-3">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[#0A3D91]" />
            <span className="text-sm font-semibold text-ink">Active (visible to users)</span>
          </label>
          <button
            onClick={() =>
              onSave({
                id: editing?.id,
                type,
                name,
                slug: name.toLowerCase().replace(/\s+/g, '-'),
                description,
                icon: editing?.icon ?? 'grid',
                parentId: parentId || null,
                active,
                sortOrder: editing?.sortOrder ?? 99,
              })
            }
            disabled={!name.trim() || pending}
            className="btn-primary w-full"
          >
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
          </button>
        </div>
      </div>
    </div>
  );
}
