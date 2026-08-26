import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorResponse } from './filter/api-error.response';
import { API_KEY_HEADER, API_KEY_SCHEME, BEARER_SCHEME } from './security';

/** Appended to the API's global prefix, which main.ts owns. */
export const DOCS_ROUTE = 'docs';

/** One reference, so the envelope is described once and pointed at from every refusal. */
const envelope = () => ({
  'application/json': { schema: { $ref: getSchemaPath(ApiErrorResponse) } },
});

type Operation = {
  security?: Record<string, string[]>[];
  requestBody?: unknown;
  parameters?: { in?: string }[];
  responses: Record<string, unknown>;
};

type Refusal = { status: string; description: string };

const METHODS = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options'] as const;

const takesParameterIn = (operation: Operation, where: string) =>
  (operation.parameters ?? []).some((parameter) => parameter.in === where);

/**
 * What each operation refuses, read off what it already declares. The perimeter
 * is uniform — every route is guarded unless a decorator says otherwise, every
 * body goes through the one validation pipe — so the refusals follow from the
 * document rather than from 23 hand-written repetitions of them, and a route
 * that changes its guard changes its documented refusals with it.
 */
function refusals(operation: Operation): Refusal[] {
  const asks = (scheme: string) =>
    (operation.security ?? []).some((requirement) => scheme in requirement);

  const answered: [boolean, Refusal][] = [
    [
      Boolean(operation.requestBody) || takesParameterIn(operation, 'query'),
      { status: '400', description: 'The request failed validation' },
    ],
    [
      operation.security === undefined,
      { status: '401', description: 'No bearer token, or not a valid one' },
    ],
    [
      asks(API_KEY_SCHEME),
      { status: '403', description: `No \`${API_KEY_HEADER}\` header, or not the configured key` },
    ],
    [takesParameterIn(operation, 'path'), { status: '404', description: 'No row with that id' }],
  ];

  return answered.filter(([answers]) => answers).map(([, refusal]) => refusal);
}

/**
 * Attaches those refusals to every operation in the document. A status the
 * route documented itself is left alone: it knows more than the perimeter does
 * — which Products a delete is still referenced by, say — and this is a default
 * rather than an override.
 */
export function documentRefusals(document: OpenAPIObject): OpenAPIObject {
  for (const item of Object.values(document.paths)) {
    for (const method of METHODS) {
      const operation = item[method] as Operation | undefined;
      if (!operation) continue;

      for (const { status, description } of refusals(operation)) {
        operation.responses[status] ??= { description, content: envelope() };
      }
    }
  }

  return document;
}

/**
 * Bearer auth is required document-wide, mirroring the global guard of
 * ADR-0002: a route is documented as protected unless a decorator says
 * otherwise, exactly as it is protected unless a decorator says otherwise.
 *
 * The path is `DOCS_ROUTE` under the global prefix. main.ts builds the same
 * string before this runs — it has to register the security headers and CORS
 * ahead of the route Swagger adds here — so the constant is the shared truth
 * rather than this return value.
 */
export function setupDocs(app: INestApplication, globalPrefix: string) {
  const path = `${globalPrefix}/${DOCS_ROUTE}`;

  const config = new DocumentBuilder()
    .setTitle('Aze API')
    .setDescription(
      'Every route requires a bearer token unless it is marked otherwise. ' +
        'Register or log in, then paste the accessToken into Authorize to call the rest. ' +
        'Every refusal, whatever the status, arrives as an ApiErrorResponse.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER_SCHEME)
    .addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, API_KEY_SCHEME)
    .addSecurityRequirements(BEARER_SCHEME)
    .build();

  // The envelope is reached only through the references documentRefusals writes,
  // so nothing would pull its schema into the document without this.
  const document = documentRefusals(
    SwaggerModule.createDocument(app, config, { extraModels: [ApiErrorResponse] }),
  );

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: `${path}-json`,
  });

  return path;
}
