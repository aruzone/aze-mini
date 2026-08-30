import { ResetPasswordForm } from './form';
import { Shell } from '../../components/shell';

/**
 * Where the reset email's link lands (ADR-0011). The token arrives in the
 * query string, the new password is posted to the API from the server side,
 * and every session the User had dies with the old password (ADR-0009).
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Shell>
      <div className="mx-auto max-w-sm">
        <h1 className="text-display font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted">
          The link works for one hour. Resetting signs out every session.
        </p>
        <ResetPasswordForm token={token ?? ''} />
      </div>
    </Shell>
  );
}
