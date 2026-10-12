import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDisputes, resolveDispute } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDateTime } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { Dispute } from '../../types';

export function AdminDisputesPage() {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [note, setNote] = useState('');

  const disputesQuery = useQuery({ queryKey: ['admin-disputes'], queryFn: getDisputes });

  const resolveMutation = useMutation({
    mutationFn: ({ disputeId, status, note }: { disputeId: string; status: Dispute['status']; note: string }) =>
      resolveDispute(adminId, disputeId, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
      setResolving(null);
      setNote('');
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Dispute Resolution</h2>
        <p className="text-xs text-ink-secondary">Resolve buyer–seller conflicts and decide fund allocation</p>
      </div>

      {disputesQuery.isLoading ? (
        <Spinner label="Loading disputes…" />
      ) : !disputesQuery.data || disputesQuery.data.length === 0 ? (
        <EmptyState icon="check" title="No disputes" message="When buyers raise disputes, they appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {disputesQuery.data.map((dispute) => (
            <div key={dispute.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-secondary">{dispute.orderId}</span>
                <Badge
                  variant={dispute.status === 'open' ? 'error' : 'success'}
                >
                  {dispute.status === 'open' ? 'Open' : dispute.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm font-bold text-ink">{dispute.reason}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{dispute.details}</p>
              <p className="mt-2 text-[11px] text-ink-secondary">
                Raised by {dispute.raisedByName} · {formatDateTime(dispute.createdAt)}
              </p>
              {dispute.resolutionNote && (
                <p className="mt-2 rounded-lg bg-surface p-2 text-[11px] text-ink-secondary">
                  Resolution: {dispute.resolutionNote}
                </p>
              )}
              {dispute.status === 'open' && (
                <button
                  onClick={() => setResolving(dispute)}
                  className="btn-primary mt-3 w-full py-2 text-sm"
                >
                  Resolve dispute
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={() => setResolving(null)}>
          <div className="safe-bottom w-full max-w-lg rounded-t-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
            <h2 className="text-lg font-bold text-ink">Resolve: {resolving.reason}</h2>
            <p className="mt-1 text-sm text-ink-secondary">{resolving.orderId}</p>
            <div className="mt-4 flex flex-col gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Resolution note (visible to both parties)…"
                className="input-field resize-none"
              />
              <button
                onClick={() => note.trim() && resolveMutation.mutate({ disputeId: resolving.id, status: 'resolved_buyer', note: note.trim() })}
                disabled={!note.trim() || resolveMutation.isPending}
                className="btn-primary w-full"
              >
                Side with buyer (refund)
              </button>
              <button
                onClick={() => note.trim() && resolveMutation.mutate({ disputeId: resolving.id, status: 'resolved_seller', note: note.trim() })}
                disabled={!note.trim() || resolveMutation.isPending}
                className="btn-secondary w-full"
              >
                Side with seller (release)
              </button>
              <button
                onClick={() => note.trim() && resolveMutation.mutate({ disputeId: resolving.id, status: 'split', note: note.trim() })}
                disabled={!note.trim() || resolveMutation.isPending}
                className="btn-secondary w-full"
              >
                Split funds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
