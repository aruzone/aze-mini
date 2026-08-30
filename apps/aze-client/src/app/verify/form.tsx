'use client';

import { useActionState } from 'react';
import { verifyEmail, VerifyEmailState } from '../actions';

const EMPTY: VerifyEmailState = {};

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, submit, pending] = useActionState(verifyEmail, EMPTY);

  return (
    <form action={submit} className="mt-8 rounded-lg border border-border bg-raised p-6">
      <input type="hidden" name="token" value={token} />

      {state.message && (
        <p
          role="status"
          className="rounded-md border border-field px-3 py-2 text-sm font-medium"
        >
          {state.message}
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger"
        >
          {state.error}
        </p>
      )}

      {!state.message && (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Verifying…' : 'Verify my email'}
        </button>
      )}
    </form>
  );
}
