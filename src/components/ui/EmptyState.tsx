import { Icon } from './Icon';

export function EmptyState({
  icon = 'grid',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <Icon name={icon} size={32} />
      </div>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-xs text-sm text-ink-secondary">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
