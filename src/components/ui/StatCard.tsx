import { Icon } from './Icon';

export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
          <Icon name={icon} size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-secondary">{label}</p>
          <p className="truncate text-lg font-bold text-ink">{value}</p>
          {sub && <p className="truncate text-xs text-ink-secondary">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
