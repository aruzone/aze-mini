'use client';

import { useActionState } from 'react';
import { resetPassword, ResetPasswordState } from '../actions';

const EMPTY: ResetPasswordState = {};

const FIELD =
  'mt-1.5 w-full rounded-md border border-field bg-raised px-3 py-2 text-sm';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState(resetPassword, EMPTY);

  return (
    <form action={submit} className="mt-8 rounded-lg border border-border bg-raised p-6">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={FIELD}
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

      {!state.message && (
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save the new password'}
        </button>
      )}
    </form>
  );
}
