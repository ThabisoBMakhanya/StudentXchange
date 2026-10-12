import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from '../../lib/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDateTime } from '../../lib/utils';

const ACTION_ICON: Record<string, string> = {
  FUNDS_WITHHELD: 'alert',
  FUNDS_RELEASED: 'check',
  FUNDS_REFUNDED: 'refresh',
  FUNDS_SPLIT: 'scale',
  USER_SUSPENDED: 'pause',
  USER_BANNED: 'ban',
  USER_REACTIVATED: 'check',
  KYC_APPROVED: 'shield',
  KYC_REJECTED: 'x',
  CATEGORY_SAVED: 'tag',
  CATEGORY_DELETED: 'trash',
  DISPUTE_RESOLVED: 'check',
  PAYOUT_PAID: 'wallet',
  COMMISSION_UPDATED: 'percent',
};

export function AdminAuditPage() {
  const auditQuery = useQuery({ queryKey: ['admin-audit'], queryFn: getAuditLog });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Audit Log</h2>
        <p className="text-xs text-ink-secondary">Immutable trail of every admin action</p>
      </div>

      {auditQuery.isLoading ? (
        <Spinner label="Loading audit log…" />
      ) : !auditQuery.data || auditQuery.data.length === 0 ? (
        <EmptyState icon="history" title="No entries" message="Admin actions will be recorded here." />
      ) : (
        <div className="flex flex-col gap-2">
          {auditQuery.data.map((entry) => (
            <div key={entry.id} className="card flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                <Icon name={ACTION_ICON[entry.action] ?? 'info'} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-secondary">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{entry.detail}</p>
                <p className="mt-1 text-[10px] text-ink-secondary/70">
                  {entry.actorName} · {entry.targetType} #{entry.targetId}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
