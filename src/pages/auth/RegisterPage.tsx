import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { register } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../lib/utils';
import type { MarketplaceRole } from '../../types';

export function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setUserRoles = useRoleStore((s) => s.setUserRoles);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [university, setUniversity] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<MarketplaceRole[]>(['customer']);
  const [error, setError] = useState('');

  const toggleRole = (role: MarketplaceRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const mutation = useMutation({
    mutationFn: () => register({ fullName, email, phone, university, roles, password }),
    onSuccess: ({ user, token }) => {
      setUser(user, token);
      setUserRoles(user.id, user.roles);
      navigate('/');
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="safe-top mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-10 pt-10">
        <Link to="/login" className="mb-6 inline-flex w-fit items-center gap-1 text-sm font-semibold text-ink-secondary hover:text-primary">
          <Icon name="arrowLeft" size={16} /> Back to sign in
        </Link>

        <h1 className="text-2xl font-extrabold text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Join StudentXchange as a customer, a seller, or both.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (roles.length === 0) {
              setError('Select at least one role: Customer or Seller.');
              return;
            }
            setError('');
            mutation.mutate();
          }}
          className="mt-6 flex flex-col gap-4"
        >
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-sm font-semibold text-ink">Full name</label>
            <input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-sm font-semibold text-ink">Email</label>
            <input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-ink">Phone</label>
            <input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="university" className="mb-1.5 block text-sm font-semibold text-ink">University</label>
            <select id="university" required value={university} onChange={(e) => setUniversity(e.target.value)} className="input-field">
              <option value="">Select a university</option>
              <option>University of Eswatini</option>
              <option>Limkokwing University</option>
              <option>Eswatini Medical Christian University</option>
              <option>Southern African Nazarene University</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-sm font-semibold text-ink">Password</label>
            <input id="reg-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" autoComplete="new-password" />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink">I want to…</span>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { role: 'customer' as MarketplaceRole, label: 'Buy', desc: 'Shop items & services', icon: 'cart' },
                  { role: 'seller' as MarketplaceRole, label: 'Sell', desc: 'List items & services', icon: 'store' },
                ]
              ).map((opt) => (
                <button
                  key={opt.role}
                  type="button"
                  onClick={() => toggleRole(opt.role)}
                  className={cx(
                    'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition active:scale-[0.98]',
                    roles.includes(opt.role)
                      ? 'border-primary bg-primary-50'
                      : 'border-surface-border bg-white hover:border-primary-200',
                  )}
                >
                  <Icon name={opt.icon} size={20} className={roles.includes(opt.role) ? 'text-primary' : 'text-ink-secondary'} />
                  <span className="text-sm font-bold text-ink">{opt.label}</span>
                  <span className="text-xs text-ink-secondary">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
