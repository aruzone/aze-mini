import axios from 'axios';
import { anyStatus } from '../support/users';

describe('the API documentation', () => {
  let spec: {
    paths: Record<
      string,
      Record<string, { security?: Record<string, string[]>[]; parameters?: unknown }>
    >;
    components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
    security?: Record<string, string[]>[];
  };

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
        'POST /api/auth/register',
        'POST /api/auth/login',
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
    ['CreateProductDto', ['name', 'description', 'price', 'categoryId', 'tagIds']],
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
});
