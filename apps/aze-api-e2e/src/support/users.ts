import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import axios from 'axios';
import { config } from 'dotenv';

/** Read the status off the response instead of throwing on anything but 2xx. */
export const anyStatus = { validateStatus: () => true };

/**
 * Registration is the only way a User comes into existence, so specs that need
 * one get an id the database issued rather than one they invented.
 */
export async function registerUser() {
  const email = `ada-${randomUUID()}@example.com`;
  const password = 'correct horse battery staple';

  const res = await axios.post('/api/auth/register', { email, password, name: 'Ada' });

  return {
    id: res.data.userId as string,
    email,
    password,
    accessToken: res.data.accessToken as string,
  };
}

export function bearer(accessToken: string) {
  return { headers: { authorization: `Bearer ${accessToken}` }, ...anyStatus };
}

/**
 * The key the API was started with. Read from the API's own env file rather
 * than duplicated here, so the machine-to-machine Demo is exercised with the
 * same value the running server checks against.
 */
export function apiKey() {
  const fromEnv = process.env.API_KEY;
  if (fromEnv) {
    return fromEnv;
  }

  const loaded = config({ path: join(__dirname, '../../../aze-api/.env') });
  const key = loaded.parsed?.API_KEY;
  if (!key) {
    throw new Error('API_KEY is not set; the machine-to-machine spec cannot run');
  }
  return key;
}
