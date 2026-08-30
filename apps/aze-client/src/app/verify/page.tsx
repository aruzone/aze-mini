import { VerifyEmailForm } from './form';
import { Shell } from '../../components/shell';

/**
 * Where the verification email's link lands (ADR-0011). The token arrives in
 * the query string and is exchanged at the API from the server side; the email
 * itself is sent with a no-referrer policy so the token never leaks through a
 * referrer header on the way in.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Shell>
      <div className="mx-auto max-w-sm">
        <h1 className="text-display font-semibold">Verify your email</h1>
        <p className="mt-2 text-sm text-muted">
          Confirm the address you registered with.
        </p>
        <VerifyEmailForm token={token ?? ''} />
      </div>
    </Shell>
  );
}
