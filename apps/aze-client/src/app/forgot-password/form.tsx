'use client';

import { useActionState } from 'react';
import { forgotPassword, ForgotPasswordState } from '../actions';

const EMPTY: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, submit, pending] = useActionState(forgotPassword, EMPTY);

  return (
    <form action={submit} className="mt-8 rounded-lg border border-border bg-raised p-6">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1.5 w-full rounded-md border border-field bg-raised px-3 py-2 text-sm"
        />
      </label>

      {state.message && (
        <p
          role="status"
          className="mt-4 rounded-md border border-field px-3 py-2 text-sm font-medium"
        >
          {state.message}
        </p>
      )}

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
        {pending ? 'Sending…' : 'Send a reset link'}
      </button>
    </form>
  );
}
