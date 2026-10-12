import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Icon } from '../../components/ui/Icon';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('admin@student.sz');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const credentialsMutation = useMutation({
    mutationFn: async () => {
      const result = await login(email.trim(), password);
      if (!result.user.roles.includes('admin')) {
        throw new Error('This account does not have administrator access.');
      }
      return result;
    },
    onSuccess: ({ user, token }) => {
      setUser(user, token);
      navigate('/admin');
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      <div className="safe-top mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-10 pt-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-card-hover">
            <Icon name="shield" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Admin Portal</h1>
          <p className="mt-1 text-sm text-white/60">
            Restricted administrator access
          </p>
        </div>

        <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              credentialsMutation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold text-white">
                Admin email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field bg-white/10 text-white placeholder:text-white/40"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-white">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field bg-white/10 text-white placeholder:text-white/40"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-sm text-ink" role="alert">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={credentialsMutation.isPending}
              className="min-h-tap w-full rounded-xl bg-white px-5 py-3 text-base font-semibold text-primary transition active:scale-[0.98] disabled:opacity-60"
            >
              {credentialsMutation.isPending ? 'Signing in…' : 'Sign in'}
            </button>
        </form>

        <div className="mt-auto pt-10 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-medium text-white/50 hover:text-white"
          >
            ← Back to marketplace login
          </button>
        </div>
      </div>
    </div>
  );
}
