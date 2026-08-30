'use server';

import { AuthResponse, LoginRequest } from '@aze-mini/platform-contracts';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch, refreshSession, revokeSession } from '../lib/api';
import {
  currentRefreshToken,
  endSession,
  startSession,
} from '../lib/session';

export type LoginState = { error?: string };

/**
 * The credentials never reach the browser's JavaScript and the token never
 * leaves the server: the form posts here, this calls the API, and the tokens
 * go straight into httpOnly cookies — the short-lived access token and the
 * refresh token the API answers with alongside it (ADR-0009).
 */
export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  // A form field is a string or a File; the contract is what says which of
  // them the API is being sent.
  const credentials: LoginRequest = {
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };

  let refreshToken: string | undefined;
  try {
    const session = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: credentials,
      // The API delivers the refresh token as a Set-Cookie header, never in
      // the body. Capture it here and store it in the client's own httpOnly
      // cookie — this server is the browser's cookie jar.
      onResponse: (response) => {
        refreshToken = response.headers
          .getSetCookie()
          .map((cookie) => cookie.split(';')[0])
          .find((pair) => pair.startsWith('aze_refresh='))
          ?.split('=')[1];
      },
    });
    await startSession(session.accessToken, refreshToken ?? '');
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }

  // Outside the try: redirect works by throwing, and catching it here would
  // report a successful sign-in as a failure.
  redirect('/');
}

/**
 * Best-effort revocation: the API kills the presented refresh family, then
 * this clears both local cookies. A failed call must not trap the User in a
 * session they asked to end, so the cookies go regardless.
 */
export async function logout(): Promise<void> {
  const refreshToken = await currentRefreshToken();
  if (refreshToken) {
    // Best effort: the family dies at the API, and the local cookies go
    // regardless — a failed call must not trap the User in a session they
    // asked to end.
    await revokeSession(refreshToken);
  }

  await endSession();
  redirect('/login');
}

/**
 * The one silent-rotation flow: present the stored refresh token, store the
 * fresh pair it answers with. Middleware does this on navigation; actions do
 * it when a call comes back 401.
 */
export async function silentRefresh(): Promise<boolean> {
  const refreshToken = await currentRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const result = await refreshSession(refreshToken);
  if (!result) {
    await endSession();
    return false;
  }

  await startSession(result.auth.accessToken, result.refreshToken ?? refreshToken);
  return true;
}

export type VerifyEmailState = { error?: string; message?: string };

/** Exchanges the token from the verification email at the API (ADR-0011). */
export async function verifyEmail(
  _state: VerifyEmailState,
  form: FormData,
): Promise<VerifyEmailState> {
  try {
    const notice = await apiFetch<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token: String(form.get('token') ?? '') },
    });
    return { message: notice.message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

export type ResetPasswordState = { error?: string; message?: string };

/** Writes the new password and revokes every session the User had (ADR-0011). */
export async function resetPassword(
  _state: ResetPasswordState,
  form: FormData,
): Promise<ResetPasswordState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) {
    return { error: 'The password must be at least 8 characters long.' };
  }

  try {
    const notice = await apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token: String(form.get('token') ?? ''), password },
    });
    return { message: notice.message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

export type ForgotPasswordState = { error?: string; message?: string };

/**
 * Asks the API to send a reset link. The answer is the same whether or not
 * the address exists (ADR-0011), so the page relays it without judgement.
 */
export async function forgotPassword(
  _state: ForgotPasswordState,
  form: FormData,
): Promise<ForgotPasswordState> {
  try {
    const notice = await apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email: String(form.get('email') ?? '') },
    });
    return { message: notice.message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}
