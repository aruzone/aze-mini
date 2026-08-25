import { UserProfile, Wire } from '@aze-mini/platform-contracts';
import Image from 'next/image';
import Link from 'next/link';
import { logout } from './actions';
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
    <main className="mx-auto max-w-2xl p-8">
      <Image src="/assets/aze-logo.png" alt="Aze" width={160} height={80} />

      <h1 className="mt-6 text-2xl font-semibold">
        Signed in as {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{user.email}</p>

      <p className="mt-6">
        <Link href="/catalogue" className="underline">
          Browse the Demo catalogue
        </Link>
      </p>

      <form action={logout} className="mt-8">
        <button type="submit" className="rounded border px-3 py-1 text-sm">
          Sign out
        </button>
      </form>
    </main>
  );
}
