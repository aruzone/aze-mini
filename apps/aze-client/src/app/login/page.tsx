'use client';

import { useActionState } from 'react';
import { login, LoginState } from '../actions';
import { Shell } from '../../components/shell';

const EMPTY: LoginState = {};

const FIELD =
  'mt-1.5 w-full rounded-md border border-field bg-raised px-3 py-2 text-sm';

export default function LoginPage() {
  const [state, submit, pending] = useActionState(login, EMPTY);

  return (
    <Shell>
      <div className="mx-auto max-w-sm">
        <h1 className="text-display font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          The seeded Demo User is printed by{' '}
          <code className="rounded-sm bg-surface px-1 py-0.5">npx prisma db seed</code>.
        </p>

        <form action={submit} className="mt-8 rounded-lg border border-border bg-raised p-6">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className={FIELD}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={FIELD}
            />
          </label>

          {state.error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </Shell>
  );
}
