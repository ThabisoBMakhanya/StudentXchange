import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Header } from '../../components/layout/Header';
import { SellerModeBar } from '../../components/layout/SellerModeBar';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../lib/utils';

const KYC_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral'; desc: string }> = {
  approved: { label: 'Approved', variant: 'success', desc: 'Your identity is verified. You can receive payouts.' },
  pending: { label: 'Under review', variant: 'warning', desc: 'We are verifying your documents. This usually takes 1–2 business days.' },
  rejected: { label: 'Rejected', variant: 'error', desc: 'Your documents were rejected. Please resubmit clear photos.' },
  not_submitted: { label: 'Not submitted', variant: 'neutral', desc: 'Submit your documents to start selling and receiving payouts.' },
};

export function SellerKycPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [idNumber, setIdNumber] = useState('');
  const [idPreview, setIdPreview] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!user) return null;
  const kyc = KYC_STATUS[user.kycStatus];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({ kycStatus: 'pending' });
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SellerModeBar />
      <Header title="KYC Verification" onBack={() => navigate('/seller')} />

      <main className="flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          <section className="card flex items-start gap-3 p-4">
            <div
              className={cx(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                user.kycStatus === 'approved' && 'bg-primary-600 text-white',
                user.kycStatus === 'pending' && 'bg-warning-bg text-ink',
                user.kycStatus === 'rejected' && 'bg-ink text-white',
                user.kycStatus === 'not_submitted' && 'bg-surface text-ink-secondary',
              )}
            >
              <Icon name="shield" size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink">Verification status</h2>
                <Badge variant={kyc.variant}>{kyc.label}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{kyc.desc}</p>
            </div>
          </section>

          {user.kycStatus === 'not_submitted' || user.kycStatus === 'rejected' ? (
            <form onSubmit={submit} className="card flex flex-col gap-4 p-4">
              <h2 className="text-sm font-bold text-ink">Submit documents</h2>
              <p className="text-xs leading-relaxed text-ink-secondary">
                We need a valid national ID or student card to comply with Eswatini financial regulations and
                protect buyers in escrow.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">
                  National ID / Student card number
                </label>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  required
                  placeholder="e.g. ESW1234567890"
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">
                  Photo of document
                </label>
                <button
                  type="button"
                  onClick={() => setIdPreview(true)}
                  className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-border bg-surface px-4 py-6 text-sm font-semibold text-ink-secondary transition hover:border-primary-200 hover:text-primary active:scale-[0.99]"
                >
                  <Icon name="camera" size={20} />
                  {idPreview ? 'Document attached ✓' : 'Tap to attach photo'}
                </button>
              </div>
              <button type="submit" disabled={!idPreview} className="btn-primary w-full">
                Submit for review
              </button>
              {submitted && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-600">
                  <Icon name="check" size={14} /> Submitted — status updated to pending.
                </p>
              )}
            </form>
          ) : (
            <section className="card flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
              <Icon name="info" size={20} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-primary-800">
                {user.kycStatus === 'pending'
                  ? 'Your documents are being reviewed. You will be notified once approved.'
                  : 'Your identity is verified. Payouts are released to your MTN MoMo wallet.'}
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
