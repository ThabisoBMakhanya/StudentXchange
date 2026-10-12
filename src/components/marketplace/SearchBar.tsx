import { Icon } from '../ui/Icon';

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search items and services…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-secondary">
        <Icon name="search" size={18} />
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field h-12 pl-11 pr-11 shadow-sm"
        aria-label="Search"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl bg-surface text-ink-secondary transition hover:bg-primary-50 hover:text-primary active:scale-95"
          aria-label="Clear search"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
