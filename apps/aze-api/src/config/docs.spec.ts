import { OpenAPIObject } from '@nestjs/swagger';
import { documentRefusals } from './docs';
import { API_KEY_SCHEME, BEARER_SCHEME } from './security';

const ENVELOPE = '#/components/schemas/ApiErrorResponse';

const answered = { '200': { description: '' } };

function documentOf(paths: Record<string, unknown>): OpenAPIObject {
  return {
    openapi: '3.0.0',
    info: { title: 'Aze API', version: '1.0' },
    security: [{ [BEARER_SCHEME]: [] }],
    components: { schemas: {} },
    paths,
  } as OpenAPIObject;
}

function refusalsOf(document: OpenAPIObject, path: string, method: string): string[] {
  const operation = document.paths[path][method] as {
    responses: Record<string, unknown>;
  };
  return Object.keys(operation.responses).filter((status) => status >= '400');
}

function refusal(document: OpenAPIObject, path: string, method: string, status: string) {
  const operation = document.paths[path][method] as {
    responses: Record<string, { description: string; content: unknown }>;
  };
  return operation.responses[status];
}

describe('the refusals the document carries', () => {
  it('shows a route inheriting the document guard refusing without a token', () => {
    const document = documentRefusals(
      documentOf({ '/api/users/me': { get: { responses: { ...answered } } } }),
    );

    expect(refusalsOf(document, '/api/users/me', 'get')).toEqual(['401']);
  });

  it('shows the machine-to-machine route refusing the key, not the token', () => {
    const document = documentRefusals(
      documentOf({
        '/api/products': {
          post: {
            security: [{ [API_KEY_SCHEME]: [] }],
            requestBody: {},
            responses: { ...answered },
          },
        },
      }),
    );

    expect(refusalsOf(document, '/api/products', 'post')).toEqual(['400', '403']);
  });

  it('leaves a public route asking for no credential', () => {
    const document = documentRefusals(
      documentOf({
        '/api': { get: { security: [{}], responses: { ...answered } } },
      }),
    );

    expect(refusalsOf(document, '/api', 'get')).toEqual([]);
  });

  it('shows a body being validated', () => {
    const document = documentRefusals(
      documentOf({
        '/api/auth/login': {
          post: { security: [{}], requestBody: {}, responses: { ...answered } },
        },
      }),
    );

    expect(refusalsOf(document, '/api/auth/login', 'post')).toEqual(['400']);
  });

  it('shows a query parameter being validated', () => {
    const document = documentRefusals(
      documentOf({
        '/api/products': {
          get: {
            parameters: [{ name: 'limit', in: 'query' }],
            responses: { ...answered },
          },
        },
      }),
    );

    expect(refusalsOf(document, '/api/products', 'get')).toEqual(['400', '401']);
  });

  it('shows a route addressing one row answering for a row that is absent', () => {
    const document = documentRefusals(
      documentOf({
        '/api/tag/{id}': {
          get: { parameters: [{ name: 'id', in: 'path' }], responses: { ...answered } },
        },
      }),
    );

    expect(refusalsOf(document, '/api/tag/{id}', 'get')).toEqual(['401', '404']);
  });

  it('describes every refusal it adds with the one envelope', () => {
    const document = documentRefusals(
      documentOf({
        '/api/tag/{id}': {
          patch: {
            parameters: [{ name: 'id', in: 'path' }],
            requestBody: {},
            responses: { ...answered },
          },
        },
      }),
    );

    for (const status of refusalsOf(document, '/api/tag/{id}', 'patch')) {
      expect(refusal(document, '/api/tag/{id}', 'patch', status).content).toEqual({
        'application/json': { schema: { $ref: ENVELOPE } },
      });
    }
  });

  // A route saying something specific about a status knows more than the
  // perimeter does, so the derivation is a default rather than an override.
  it('leaves a refusal the route documented itself alone', () => {
    const declared = { description: 'Named the reviews still pointing at it' };
    const document = documentRefusals(
      documentOf({
        '/api/products/{id}': {
          delete: {
            parameters: [{ name: 'id', in: 'path' }],
            responses: { ...answered, '404': declared },
          },
        },
      }),
    );

    expect(refusal(document, '/api/products/{id}', 'delete', '404')).toBe(declared);
  });

  it('leaves the success the operation already documents', () => {
    const document = documentRefusals(
      documentOf({ '/api/users/me': { get: { responses: { ...answered } } } }),
    );

    expect(refusal(document, '/api/users/me', 'get', '200')).toEqual({ description: '' });
  });
});
