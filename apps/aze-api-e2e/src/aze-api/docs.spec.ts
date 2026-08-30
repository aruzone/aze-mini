import axios from 'axios';
import { Components, Schema, schemaProblems } from '../support/documented-schema';
import { createCatalogueProduct } from '../support/catalogue';
import { anyStatus, asUser, registerUser } from '../support/users';

const ENVELOPE = '#/components/schemas/ApiErrorResponse';

type Operation = {
  security?: Record<string, string[]>[];
  parameters?: unknown;
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
};

describe('the API documentation', () => {
  let spec: {
    paths: Record<string, Record<string, Operation>>;
    components: { securitySchemes: Record<string, unknown>; schemas: Components };
    security?: Record<string, string[]>[];
  };

  /** Every operation the document carries, named as a caller would name it. */
  const operations = () =>
    Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        name: `${method.toUpperCase()} ${path}`,
        operation,
      })),
    );

  const answerFor = (path: string, method: string, status: string) =>
    spec.paths[path][method].responses[status];

  const schemaFor = (path: string, method: string, status: string) =>
    answerFor(path, method, status).content['application/json'].schema;

  beforeAll(async () => {
    const res = await axios.get('/api/docs-json', anyStatus);
    expect(res.status).toBe(200);
    spec = res.data;
  });

  it('serves the interactive page', async () => {
    const res = await axios.get('/api/docs', anyStatus);

    expect(res.status).toBe(200);
    expect(res.data).toMatch(/swagger/i);
  });

  // Every route, not a sample: a resource dropped from the document should
  // fail here rather than quietly stop being documented.
  it('lists every endpoint the API serves', () => {
    const documented = Object.entries(spec.paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();

    expect(documented).toEqual(
      [
        'GET /api',
        'GET /api/health/live',
        'GET /api/health/ready',
        'GET /api/metrics',
        'POST /api/auth/login',
        'POST /api/auth/register',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'POST /api/auth/forgot-password',
        'POST /api/auth/reset-password',
        'POST /api/auth/verify-email',
        'GET /api/users/me',
        'GET /api/products',
        'POST /api/products',
        'GET /api/products/{id}',
        'PATCH /api/products/{id}',
        'DELETE /api/products/{id}',
        'GET /api/categories',
        'POST /api/categories',
        'GET /api/categories/{id}',
        'PATCH /api/categories/{id}',
        'DELETE /api/categories/{id}',
        'GET /api/tag',
        'POST /api/tag',
        'GET /api/tag/{id}',
        'PATCH /api/tag/{id}',
        'DELETE /api/tag/{id}',
        'POST /api/review',
        'GET /api/review/{id}',
        'PATCH /api/review/{id}',
        'DELETE /api/review/{id}',
      ].sort(),
    );
  });

  // Without the CLI plugin every property is annotated by hand, so a field
  // added to a DTO without @ApiProperty would vanish from the schema silently.
  it.each([
    ['LoginDto', ['email', 'password']],
    ['ForgotPasswordDto', ['email']],
    ['ResetPasswordDto', ['token', 'password']],
    ['VerifyEmailDto', ['token']],
    ['CreateProductCategoryDto', ['name']],
    ['CreateTagDto', ['name', 'productIds']],
    ['CreateReviewDto', ['rating', 'comment', 'productId']],
    ['RegisterDto', ['email', 'password', 'name']],
    ['LoginDto', ['email', 'password']],
  ])('documents every property of %s', (dto, properties) => {
    const schema = spec.components.schemas[dto] as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(schema.properties).sort()).toEqual([...properties].sort());
  });

  // Both have defaults, so demanding them in the UI would misdescribe the API.
  it('marks the optional query parameters optional', () => {
    const params = spec.paths['/api/products'].get.parameters as {
      name: string;
      required: boolean;
    }[];

    for (const param of params) {
      expect([param.name, param.required]).toEqual([param.name, false]);
    }
  });

  it('separates the required fields of a body from the optional ones', () => {
    const product = spec.components.schemas['CreateProductDto'] as { required: string[] };

    expect(product.required.sort()).toEqual(['categoryId', 'name', 'price']);
  });

  it('offers a bearer token and an API key to authorize with', () => {
    expect(Object.keys(spec.components.securitySchemes)).toEqual(
      expect.arrayContaining(['bearer', 'api-key']),
    );
  });

  // The perimeter fails closed, and so does its documentation.
  it('requires a bearer token across the document by default', () => {
    expect(spec.security).toEqual([{ bearer: [] }]);
  });

  it('shows a protected route inheriting that requirement', () => {
    expect(spec.paths['/api/users/me'].get.security).toBeUndefined();
    expect(spec.paths['/api/products'].get.security).toBeUndefined();
  });

  it.each([
    ['/api', 'get'],
    ['/api/auth/login', 'post'],
    ['/api/auth/register', 'post'],
  ])('shows %s %s needing no credential', (path, method) => {
    expect(spec.paths[path][method].security).toEqual([{}]);
  });

  it('shows the machine-to-machine route asking for the key, not a token', () => {
    expect(spec.paths['/api/products'].post.security).toEqual([{ 'api-key': [] }]);
  });

  // A bare status code tells a generated client the call returned; it does not
  // say what it returned. Every route, again, rather than a sample. The content
  // type is not the point — GET /api/metrics answers in text/plain — only that
  // the response body is described at all.
  it('answers every operation with a schema, not a bare status', () => {
    const bare = operations()
      .filter(({ operation }) => {
        const success = Object.entries(operation.responses).find(([status]) =>
          status.startsWith('2'),
        );
        return !Object.values(success?.[1].content ?? {}).some(
          (media) => media.schema,
        );
      })
      .map(({ name }) => name);

    expect(bare).toEqual([]);
  });

  it('describes the error envelope once, as a component', () => {
    const envelope = spec.components.schemas['ApiErrorResponse'] as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(envelope.properties).sort()).toEqual([
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);
  });

  // Referenced rather than repeated: a refusal that restated the envelope could
  // come to describe a shape the filter never writes.
  it('points every refusal at that one envelope', () => {
    const restated = operations().flatMap(({ name, operation }) =>
      Object.entries(operation.responses)
        .filter(([status]) => status >= '400')
        .filter(([, answer]) => answer.content?.['application/json']?.schema?.$ref !== ENVELOPE)
        .map(([status]) => `${name} ${status}`),
    );

    expect(restated).toEqual([]);
  });

  // The perimeter's own refusals are derived from what each operation declares
  // about its guard, so these follow the decorators rather than a hand-kept list.
  it('shows a guarded route refusing a caller with no token', () => {
    expect(answerFor('/api/users/me', 'get', '401')).toBeDefined();
    expect(answerFor('/api/products', 'get', '401')).toBeDefined();
  });

  it('shows the machine-to-machine route refusing the key, not the token', () => {
    expect(answerFor('/api/products', 'post', '403')).toBeDefined();
    expect(spec.paths['/api/products'].post.responses['401']).toBeUndefined();
  });

  // Login's own 401 is about the credentials in the body, not about a
  // credential the perimeter asked for and did not get; it is documented by
  // the route, which is why it is not here.
  it.each([
    ['/api', 'get'],
    ['/api/auth/register', 'post'],
  ])('shows %s %s refusing no credential it never asked for', (path, method) => {
    expect(spec.paths[path][method].responses['401']).toBeUndefined();
    expect(spec.paths[path][method].responses['403']).toBeUndefined();
  });

  it('shows a validated body and a validated query answering 400', () => {
    expect(answerFor('/api/tag', 'post', '400')).toBeDefined();
    expect(answerFor('/api/products', 'get', '400')).toBeDefined();
  });

  it('shows a route that addresses one row answering 404', () => {
    expect(answerFor('/api/tag/{id}', 'get', '404')).toBeDefined();
    expect(spec.paths['/api/tag'].get.responses['404']).toBeUndefined();
  });
  // The same check the DTOs get: without the CLI plugin a field added to a
  // response class without @ApiProperty would vanish from the schema silently.
  it.each([
    ['AuthResponse', ['userId', 'email', 'accessToken']],
    ['UserProfile', ['id', 'email', 'name', 'verifiedAt', 'createdAt', 'updatedAt']],
    ['HealthResponse', ['message']],
    [
      'Product',
      ['id', 'name', 'description', 'price', 'categoryId', 'createdAt', 'updatedAt'],
    ],
    ['ProductCategory', ['id', 'name']],
    ['Review', ['id', 'rating', 'comment', 'productId', 'createdAt']],
    ['Tag', ['id', 'name']],
  ])('documents every property of %s', (schema, properties) => {
    const documented = spec.components.schemas[schema] as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(documented.properties).sort()).toEqual([...properties].sort());
  });

  it('shows the token the auth routes answer with', () => {
    for (const [path, status] of [
      ['/api/auth/register', '201'],
      ['/api/auth/login', '200'],
    ]) {
      expect(schemaFor(path, 'post', status).$ref).toBe('#/components/schemas/AuthResponse');
    }
  });
});

// The document above is a claim about what the API sends. These are the same
// claim, read against what it actually sends — the half no assertion about the
// document alone can make.
describe('what the API answers, against what the document says', () => {
  let spec: {
    paths: Record<string, Record<string, Operation>>;
    components: { schemas: Components };
  };

  beforeAll(async () => {
    spec = (await axios.get('/api/docs-json', anyStatus)).data;
  });

  const documented = (path: string, method: string, status: string) =>
    spec.paths[path][method].responses[status].content['application/json'].schema;

  const expectDocumented = (body: unknown, path: string, method: string, status: string) =>
    expect(schemaProblems(body, documented(path, method, status), spec.components.schemas)).toEqual(
      [],
    );

  it('sends what it documents for a registration', async () => {
    const res = await axios.post('/api/auth/register', {
      email: `ada-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: 'correct horse battery staple',
      name: 'Ada',
    });

    expect(res.status).toBe(201);
    expectDocumented(res.data, '/api/auth/register', 'post', '201');
  });

  it('sends what it documents for the current User', async () => {
    const user = await registerUser();

    const res = await axios.get('/api/users/me', asUser(user.accessToken));

    expect(res.status).toBe(200);
    expectDocumented(res.data, '/api/users/me', 'get', '200');
  });

  it('sends what it documents for the catalogue', async () => {
    const user = await registerUser();
    await createCatalogueProduct(user.accessToken);

    const res = await axios.get('/api/products?limit=1', asUser(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(1);
    expectDocumented(res.data, '/api/products', 'get', '200');
  });

  it('sends the envelope it documents when it refuses', async () => {
    const res = await axios.get('/api/users/me', anyStatus);

    expect(res.status).toBe(401);
    expectDocumented(res.data, '/api/users/me', 'get', '401');
  });

  // The one refusal whose `message` is a list rather than a string, which is
  // the half of the envelope a single example would never exercise.
  it('sends the envelope it documents for a field list', async () => {
    const res = await axios.post('/api/auth/register', { email: 'not an email' }, anyStatus);

    expect(res.status).toBe(400);
    expectDocumented(res.data, '/api/auth/register', 'post', '400');
  });

  it('sends what it documents for liveness', async () => {
    const res = await axios.get('/api/health/live', anyStatus);

    expect(res.status).toBe(200);
    expectDocumented(res.data, '/api/health/live', 'get', '200');
  });

  // Readiness is what the probes poll, so what it reports is asserted here
  // rather than trusted to the schema: Postgres gates, the cache never does.
  it('sends what it documents for readiness', async () => {
    const res = await axios.get('/api/health/ready', anyStatus);

    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ready');
    expect(res.data.checks.database).toBe('up');
    expect(res.data.checks.cache).toBe('up');
    expectDocumented(res.data, '/api/health/ready', 'get', '200');
  });
});
