import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useRoleStore } from '../../stores/roleStore';
import { Icon } from '../../components/ui/Icon';

export function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const setUserRoles = useRoleStore((s) => s.setUserRoles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: ({ user, token }) => {
      setUser(user, token);
      setUserRoles(user.id, user.roles);
      navigate('/');
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="safe-top mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-10 pt-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-card-hover">
            <Icon name="graduation" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-ink">StudentXchange</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Marketplace for university students in Eswatini
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            mutation.mutate();
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-ink px-4 py-3 text-sm text-white" role="alert">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={mutation.isPending} className="btn-primary w-full">
            {mutation.isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-secondary">
          New to StudentXchange?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-auto pt-10 text-center">
          <Link to="/admin/login" className="text-xs font-medium text-ink-secondary hover:text-primary">
            Admin portal →
          </Link>
        </div>
      </div>
    </div>
  );
}
