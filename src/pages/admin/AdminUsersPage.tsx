import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, setUserStatus } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id ?? 'admin-1');
  const [search, setSearch] = useState('');
  const [actingUser, setActingUser] = useState<User | null>(null);

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: getAdminUsers });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' | 'banned' }) =>
      setUserStatus(adminId, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
      setActingUser(null);
    },
  });

  const users = (usersQuery.data ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.university.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">User Management</h2>
        <p className="text-xs text-ink-secondary">View, suspend, ban, or reactivate accounts</p>
      </div>

      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="input-field pl-10"
        />
      </div>

      {usersQuery.isLoading ? (
        <Spinner label="Loading users…" />
      ) : users.length === 0 ? (
        <EmptyState icon="users" title="No users found" />
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => {
            const status = user.banned ? 'banned' : user.suspended ? 'suspended' : 'active';
            return (
              <button
                key={user.id}
                onClick={() => setActingUser(user)}
                className="card p-4 text-left transition hover:shadow-card-hover active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-white">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{user.fullName}</p>
                    <p className="truncate text-xs text-ink-secondary">{user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'error'}>
                        {status}
                      </Badge>
                      {user.roles.map((r) => (
                        <Badge key={r} variant="info" className="capitalize">{r}</Badge>
                      ))}
                    </div>
                  </div>
                  <Icon name="chevronRight" size={18} className="shrink-0 text-ink-secondary" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {actingUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50" onClick={() => setActingUser(null)}>
          <div className="safe-bottom w-full max-w-lg rounded-t-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border" />
            <h2 className="text-lg font-bold text-ink">{actingUser.fullName}</h2>
            <p className="text-sm text-ink-secondary">{actingUser.email}</p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Row label="Phone" value={actingUser.phone} />
              <Row label="University" value={actingUser.university} />
              <Row label="Joined" value={formatDate(actingUser.createdAt)} />
              <Row label="KYC" value={actingUser.kycStatus.replace('_', ' ')} />
              <Row label="Roles" value={actingUser.roles.join(', ')} />
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {actingUser.suspended || actingUser.banned ? (
                <button
                  onClick={() => statusMutation.mutate({ userId: actingUser.id, status: 'active' })}
                  disabled={statusMutation.isPending}
                  className="btn-primary w-full"
                >
                  <Icon name="check" size={18} /> Reactivate account
                </button>
              ) : (
                <>
                  <button
                    onClick={() => statusMutation.mutate({ userId: actingUser.id, status: 'suspended' })}
                    disabled={statusMutation.isPending}
                    className="btn-secondary w-full"
                  >
                    <Icon name="pause" size={18} /> Suspend account
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ userId: actingUser.id, status: 'banned' })}
                    disabled={statusMutation.isPending}
                    className="min-h-tap w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
                  >
                    <Icon name="ban" size={18} className="mr-1 inline" /> Ban account
                  </button>
                </>
              )}
              <button
                onClick={() => setActingUser(null)}
                className="min-h-tap w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-secondary transition hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-medium capitalize text-ink">{value}</span>
    </div>
  );
}
