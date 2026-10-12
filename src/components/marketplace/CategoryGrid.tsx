import type { Category } from '../../types';
import { Icon } from '../ui/Icon';

export function CategoryGrid({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat)}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-surface-border bg-white/85 p-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary-50 hover:shadow-card-hover active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-secondary/10 text-primary shadow-inner">
            <Icon name={cat.icon} size={24} />
          </div>
          <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-ink group-hover:text-primary">
            {cat.name}
          </span>
        </button>
      ))}
    </div>
  );
}
