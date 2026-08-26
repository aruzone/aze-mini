import { ApiErrorResponse } from '@aze-mini/platform-contracts';

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
  const { token, method = 'GET', body } = options;

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

  if (!response.ok) {
    throw new ApiError(response.status, await refusalFrom(response));
  }

  return response.json() as Promise<T>;
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
