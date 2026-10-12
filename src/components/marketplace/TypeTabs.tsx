import { cx } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export type ListingTypeFilter = 'all' | 'physical' | 'service';

export function TypeTabs({
  value,
  onChange,
}: {
  value: ListingTypeFilter;
  onChange: (v: ListingTypeFilter) => void;
}) {
  const tabs: { key: ListingTypeFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'grid' },
    { key: 'physical', label: 'Items', icon: 'package' },
    { key: 'service', label: 'Services', icon: 'zap' },
  ];
  return (
    <div className="flex gap-2 rounded-2xl border border-surface-border bg-surface p-1.5 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cx(
            'min-h-tap flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98]',
            value === tab.key
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-btn-primary'
              : 'text-ink-secondary hover:bg-white hover:text-primary',
          )}
        >
          <Icon name={tab.icon} size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
