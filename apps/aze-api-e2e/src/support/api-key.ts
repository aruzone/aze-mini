import { join } from 'node:path';
import { config } from 'dotenv';

/**
 * The key the API was started with, read from the API's own env file so the
 * machine-to-machine Demo is exercised with the value the running server
 * checks against. `.env` is deliberately uncommitted, so a checkout that has
 * not been through the documented setup has no key to offer.
 */
export function apiKey() {
  const fromEnv = process.env.API_KEY;
  if (fromEnv) {
    return fromEnv;
  }

  const loaded = config({ path: join(__dirname, '../../../aze-api/.env') });
  const key = loaded.parsed?.API_KEY;
  if (!key) {
    throw new Error(
      'No API_KEY: set it in the environment, or run `cp .env.example .env` in apps/aze-api as the setup instructions describe.',
    );
  }
  return key;
}
