import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getAdminKpi } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { formatSZL } from '../../lib/utils';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const kpiQuery = useQuery({ queryKey: ['admin-kpi'], queryFn: getAdminKpi });

  if (kpiQuery.isLoading) return <Spinner fullScreen label="Loading dashboard…" />;
  const kpi = kpiQuery.data;
  if (!kpi) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Dashboard</h2>
        <p className="text-xs text-ink-secondary">Platform overview — live escrow included</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="users" label="Total users" value={String(kpi.totalUsers)} sub={`${kpi.totalSellers} sellers`} />
        <StatCard icon="tag" label="Listings" value={String(kpi.activeListings)} sub={`of ${kpi.totalListings} total`} />
        <StatCard icon="package" label="Orders" value={String(kpi.totalOrders)} sub="All time" />
        <StatCard icon="shield" label="Escrow balance" value={formatSZL(kpi.escrowBalance)} sub="Held for sellers" />
        <StatCard icon="alert" label="Withheld" value={formatSZL(kpi.withheldBalance)} sub="Frozen by admin" />
        <StatCard icon="wallet" label="Revenue" value={formatSZL(kpi.revenue)} sub="Commission earned" />
      </div>

      <section className="card divide-y divide-surface-border">
        <button
          onClick={() => navigate('/admin/kyc')}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-bg text-ink">
            <Icon name="shield" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">KYC approvals</p>
            <p className="text-xs text-ink-secondary">Sellers waiting for verification</p>
          </div>
          {kpi.pendingKyc > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-xs font-bold text-white">
              {kpi.pendingKyc}
            </span>
          )}
          <Icon name="chevronRight" size={18} className="text-ink-secondary" />
        </button>
        <button
          onClick={() => navigate('/admin/disputes')}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
            <Icon name="alert" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Open disputes</p>
            <p className="text-xs text-ink-secondary">Need resolution</p>
          </div>
          {kpi.openDisputes > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-xs font-bold text-white">
              {kpi.openDisputes}
            </span>
          )}
          <Icon name="chevronRight" size={18} className="text-ink-secondary" />
        </button>
        <button
          onClick={() => navigate('/admin/escrow')}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Icon name="shield" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-ink">Escrow control panel</p>
            <p className="text-xs text-ink-secondary">Withhold, release, refund, or split funds</p>
          </div>
          <Icon name="chevronRight" size={18} className="text-ink-secondary" />
        </button>
      </section>
    </div>
  );
}
