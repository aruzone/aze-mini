import axios from 'axios';
import { anyStatus } from '../support/users';

describe('the API documentation', () => {
  let spec: {
    paths: Record<string, Record<string, { security?: Record<string, string[]>[] }>>;
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

  it('lists every endpoint the API serves', () => {
    const documented = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );

    expect(documented).toEqual(
      expect.arrayContaining([
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
        'GET /api/tag',
        'POST /api/tag',
        'POST /api/review',
      ]),
    );
  });

  // The schema comes from the DTO class, so a field added there shows up here
  // without anyone editing a spec file.
  it('describes a body from its DTO rather than as an empty object', () => {
    const product = spec.components.schemas['CreateProductDto'] as {
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(Object.keys(product.properties)).toEqual(
      expect.arrayContaining(['name', 'price', 'categoryId', 'description', 'tagIds']),
    );
    expect(product.required).toEqual(expect.arrayContaining(['name', 'price', 'categoryId']));
    expect(product.required).not.toContain('description');
  });

  it('offers a bearer token and an API key to authorize with', () => {
    expect(Object.keys(spec.components.securitySchemes)).toEqual(
      expect.arrayContaining(['bearer', 'api-key']),
    );
  });

  // The perimeter fails closed, and so does its documentation: a route says it
  // needs no token only where a decorator says so.
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
