import { ForgotPasswordForm } from './form';
import { Shell } from '../../components/shell';

/**
 * The entry point to the reset flow (ADR-0011). The answer never says whether
 * the address exists, and this page passes it through untouched.
 */
export default function ForgotPasswordPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-sm">
        <h1 className="text-display font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted">
          Give us your email and we will send a reset link if the address is
          registered.
        </p>
        <ForgotPasswordForm />
      </div>
    </Shell>
  );
}
