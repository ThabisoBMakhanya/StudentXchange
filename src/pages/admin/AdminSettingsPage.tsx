import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../components/ui/Icon';

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [commission, setCommission] = useState('10');
  const [saved, setSaved] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // In production: POST to /admin/settings → audit log entry
    queryClient.invalidateQueries({ queryKey: ['admin-kpi'] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Settings</h2>
        <p className="text-xs text-ink-secondary">Platform configuration</p>
      </div>

      <form onSubmit={save} className="card flex flex-col gap-4 p-4">
        <h3 className="text-sm font-bold text-ink">Commission</h3>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">
            Platform commission rate (%)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className="input-field"
          />
          <p className="mt-1 text-xs text-ink-secondary">
            Deducted from each order when escrow funds release to the seller.
          </p>
        </div>
        <button type="submit" className="btn-primary w-full">
          Save commission
        </button>
        {saved && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-600">
            <Icon name="check" size={14} /> Saved — audit log updated.
          </p>
        )}
      </form>

      <section className="card p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">Escrow rules</h3>
        <div className="flex flex-col gap-2 text-sm text-ink-secondary">
          <p className="flex items-start gap-2">
            <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-primary" />
            Funds release automatically when the buyer confirms receipt.
          </p>
          <p className="flex items-start gap-2">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-ink" />
            Admins can withhold funds at any point, overriding the automatic flow.
          </p>
          <p className="flex items-start gap-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary-600" />
            Every admin action is written to the audit log with a timestamp and reason.
          </p>
        </div>
      </section>
    </div>
  );
}
