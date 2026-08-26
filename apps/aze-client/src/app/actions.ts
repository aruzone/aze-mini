'use server';

import { AuthResponse, LoginRequest } from '@aze-mini/platform-contracts';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '../lib/api';
import { endSession, startSession } from '../lib/session';

export type LoginState = { error?: string };

/**
 * The credentials never reach the browser's JavaScript and the token never
 * leaves the server: the form posts here, this calls the API, and the token
 * goes straight into an httpOnly cookie.
 */
export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  // A form field is a string or a File; the contract is what says which of
  // them the API is being sent.
  const credentials: LoginRequest = {
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  };

  try {
    const session = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: credentials,
    });
    await startSession(session.accessToken);
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

export async function logout(): Promise<void> {
  await endSession();
  redirect('/login');
}
