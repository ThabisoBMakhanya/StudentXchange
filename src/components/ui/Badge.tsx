import type { ReactNode } from 'react';
import { cx } from '../../lib/utils';

type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'info';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-primary-600 text-white',
  error: 'bg-ink text-white',
  warning: 'bg-warning-bg text-ink border border-surface-border',
  neutral: 'bg-surface text-ink-secondary border border-surface-border',
  info: 'bg-primary-50 text-primary border border-primary-100',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
