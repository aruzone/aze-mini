import { ApiError, apiFetch } from './api';

const respondWith = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

describe('apiFetch', () => {
  const originalUrl = process.env.AZE_API_URL;

  beforeEach(() => {
    process.env.AZE_API_URL = 'http://api.test/api';
  });

  afterEach(() => {
    process.env.AZE_API_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('reads a path against the configured API', async () => {
    const fetcher = respondWith(200, [{ id: 'p1' }]);
    global.fetch = fetcher;

    await expect(apiFetch('/products')).resolves.toEqual([{ id: 'p1' }]);
    expect(fetcher.mock.calls[0][0]).toBe('http://api.test/api/products');
  });

  // The API's guard reads a bearer token and nothing else, so a call that has
  // one has to send it in the one header the guard looks at.
  it('presents a token as a bearer credential when it has one', async () => {
    const fetcher = respondWith(200, { id: 'u1' });
    global.fetch = fetcher;

    await apiFetch('/users/me', { token: 'a-token' });

    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      authorization: 'Bearer a-token',
    });
  });

  it('sends no authorization header when it has no token', async () => {
    const fetcher = respondWith(200, {});
    global.fetch = fetcher;

    await apiFetch('/');

    expect(fetcher.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  // The envelope is ApiErrorResponse, whose `message` is a string for a single
  // failure and an array for a field list. A caller rendering the refusal wants
  // one string either way rather than two cases to handle at every call site.
  it('raises the refusal the API described, as one message', async () => {
    global.fetch = respondWith(401, {
      statusCode: 401,
      timestamp: '2026-08-25T00:00:00.000Z',
      path: '/api/auth/login',
      message: 'Invalid credentials',
    });

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('joins a per-field refusal into one message', async () => {
    global.fetch = respondWith(400, {
      statusCode: 400,
      message: ['email must be an email', 'password should not be empty'],
    });

    const error = await apiFetch('/auth/register').catch((e: ApiError) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(
      'email must be an email, password should not be empty',
    );
  });

  // A gateway or proxy can refuse before the API is reached, and that refusal
  // is not in the API's envelope at all.
  it('still raises something readable when the body is not the envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(apiFetch('/products')).rejects.toMatchObject({ status: 502 });
  });
});
