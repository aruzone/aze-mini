import { ApiErrorResponse, AuthResponse } from '@aze-mini/platform-contracts';
import { REFRESH_COOKIE } from './session';

/**
 * Where the API lives, read at request time rather than baked in at build time.
 * A `NEXT_PUBLIC_` variable is compiled into the bundle, which would make one
 * image per environment — the opposite of what the Helm values in `deploy/`
 * are for. This is read on the server, so one image serves every environment.
 */
export function apiUrl(): string {
  const configured = process.env.AZE_API_URL;
  if (configured) {
    return configured;
  }

  // The API refuses to start on a variable it was not given rather than
  // guessing (src/config/configuration.ts). Falling back to localhost in a
  // deployed client would be the same mistake, and would show up as every
  // page failing for a reason nothing named.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AZE_API_URL is not set, so the client has no API to talk to. See apps/aze-client/.env.example.',
    );
  }

  return 'http://localhost:3030/api';
}

/**
 * The rotated refresh token the API sets, read off a response's `Set-Cookie`
 * headers. The API deliberately never puts a refresh token in a body, so
 * every caller that stores one reads it here rather than walking the headers
 * itself.
 */
export function refreshTokenFrom(response: Response): string | undefined {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .find((pair) => pair.startsWith(`${REFRESH_COOKIE}=`))
    ?.split('=')[1];
}

/** A refusal the API described, carrying the status it answered with. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = {
  token?: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  /**
   * Login and register answer with a `Set-Cookie` for the refresh token in
   * addition to the JSON body. The client's server is the cookie jar for the
   * browser, so the caller passes this to capture the header and store the
   * token in its own httpOnly cookie.
   */
  onResponse?: (response: Response) => void;
};

/**
 * The one place the client talks to the API. Everything it returns is a
 * contract from `@aze-mini/platform-contracts` or `@aze-mini/demo-contracts`,
 * read through `Wire` — the caller names which, and nothing here redeclares a
 * shape the API already publishes.
 *
 * Every call runs on the server: the token lives in an httpOnly cookie that
 * browser script cannot read, so the browser never holds a credential and
 * never talks to the API directly. That is also why no CORS header is involved
 * in anything below.
 */
export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { token, method = 'GET', body, onResponse } = options;

  const response = await fetch(`${apiUrl()}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    // The token identifies the User, so a shared cache would serve one User's
    // answer to another.
    cache: 'no-store',
  });

  onResponse?.(response);

  if (!response.ok) {
    throw new ApiError(response.status, await refusalFrom(response));
  }

  return response.json() as Promise<T>;
}

/**
 * Silent rotation (ADR-0009): present the refresh token, get a fresh access
 * token and a rotated refresh cookie back. The refresh token rides in a
 * Cookie header — the client server is the cookie jar — and the rotated
 * replacement is read off the response's `Set-Cookie` headers, because the
 * API deliberately never puts a refresh token in a body.
 */
export async function refreshSession(
  refreshToken: string,
): Promise<{ auth: AuthResponse; refreshToken?: string } | null> {
  const response = await fetch(`${apiUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const auth = (await response.json()) as AuthResponse;
  return { auth, refreshToken: refreshTokenFrom(response) };
}

/**
 * Logout (ADR-0009): revoke the presented refresh family at the API. Best
 * effort from the caller's side — the local cookies are cleared regardless,
 * and an expired or unknown token simply has nothing left to revoke.
 */
export async function revokeSession(refreshToken: string): Promise<void> {
  await fetch(`${apiUrl()}/auth/logout`, {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    cache: 'no-store',
  }).catch(() => undefined);
}

// ApiErrorResponse says `message` is a string or a list of them. A caller
// rendering a refusal wants one string either way, rather than the same two
// cases spelled out at every call site.
async function refusalFrom(response: Response): Promise<string> {
  const envelope = await response
    .json()
    .then((body) => body as Partial<ApiErrorResponse>)
    .catch(() => undefined);

  const message = envelope?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string') {
    return message;
  }

  // Anything that refused before reaching the API — a proxy, a gateway — never
  // wrote the envelope, and the status is the only thing left to say.
  return `The request failed with status ${response.status}`;
}
