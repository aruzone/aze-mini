import { randomUUID } from 'node:crypto';
import { AuthResponse } from '@aze-mini/platform-contracts';
import axios from 'axios';

/** Read the status off the response instead of throwing on anything but 2xx. */
export const anyStatus = { validateStatus: () => true };

/**
 * Registration is the only way a User comes into existence, so specs that need
 * one get an id the database issued rather than one they invented.
 */
export async function registerUser() {
  const email = `ada-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';

  const res = await axios.post<AuthResponse>('/api/auth/register', {
    email,
    password,
    name: 'Ada',
  });

  return { id: res.data.userId, email, password, accessToken: res.data.accessToken };
}

/** Calls as the holder of this token, reading the status rather than throwing. */
export function asUser(accessToken: string) {
  return { headers: { authorization: `Bearer ${accessToken}` }, ...anyStatus };
}
