import { Icon } from '../ui/Icon';

export function Header({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-surface-border bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-ink shadow-sm transition hover:bg-primary-50 hover:text-primary active:scale-95"
            aria-label="Go back"
          >
            <Icon name="arrowLeft" size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
