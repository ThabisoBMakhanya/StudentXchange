/** Format SZL currency */
export function formatSZL(amount: number): string {
  return `E${amount.toLocaleString('en-SZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format date for display */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format date + time */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Escrow state → badge styling */
export const ESCROW_BADGE: Record<string, { label: string; classes: string }> = {
  pending_payment: { label: 'Awaiting Payment', classes: 'badge-warning' },
  held: { label: 'In Escrow', classes: 'badge-success' },
  withheld_by_admin: { label: 'Withheld by Admin', classes: 'badge-error' },
  released: { label: 'Released', classes: 'badge-success' },
  refunded: { label: 'Refunded', classes: 'badge-neutral' },
  split: { label: 'Split', classes: 'badge-neutral' },
  disputed: { label: 'Disputed', classes: 'badge-error' },
};

/** Payment method display */
export const PAYMENT_LABELS: Record<string, string> = {
  dpo_pay: 'DPO Pay (Card)',
  mtn_momo: 'MTN MoMo',
};

/** Simple class joiner */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Deterministic gradient key → tailwind gradient classes (black/white/blue only) */
export const LISTING_GRADIENTS: Record<string, string> = {
  blue: 'from-primary via-primary-500 to-accent',
};
