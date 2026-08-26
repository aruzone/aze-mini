import { UserProfile, Wire } from '@aze-mini/platform-contracts';
import Link from 'next/link';
import { logout } from './actions';
import { Shell } from '../components/shell';
import { apiFetch } from '../lib/api';
import { currentToken } from '../lib/session';

// Rendered per request: it reads a cookie, so there is nothing to prerender.
export const dynamic = 'force-dynamic';

export default async function Index() {
  // The middleware has already turned away anyone without a cookie, so a token
  // is present here — but the API is what decides whether it is any good.
  const user = await apiFetch<Wire<UserProfile>>('/users/me', {
    token: await currentToken(),
  });

  return (
    <Shell
      action={
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-field px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Sign out
          </button>
        </form>
      }
    >
      <h1 className="text-display font-semibold">Signed in as {user.name ?? user.email}</h1>
      <p className="mt-2 text-sm text-muted">{user.email}</p>

      {/* No heading in here: `session.spec.ts` queries this page's heading
          unqualified, and a second one fails Playwright's strict mode. */}
      <div className="mt-8 rounded-lg border border-border bg-raised p-6">
        <p className="text-sm text-muted">
          A page reading the API from the server, with the session cookie the sign-in set.
        </p>
        <p className="mt-4">
          <Link
            href="/catalogue"
            className="font-medium text-accent underline underline-offset-4"
          >
            Browse the Demo catalogue
          </Link>
        </p>
      </div>
    </Shell>
  );
}
