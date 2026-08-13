import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'api/docs';

export const BEARER_SCHEME = 'bearer';
export const API_KEY_SCHEME = 'api-key';

/**
 * Bearer auth is required document-wide, matching the global guard: a route is
 * documented as protected unless it says otherwise, the same way it *is*
 * protected unless it says otherwise. `@Public()` and `@MachineToMachine()`
 * carry the exception, so the docs cannot drift from the perimeter.
 */
export function setupDocs(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Aze API')
    .setDescription(
      'Every route requires a bearer token unless it is marked otherwise. ' +
        'Register or log in, then paste the accessToken into Authorize to call the rest.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER_SCHEME)
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, API_KEY_SCHEME)
    .addSecurityRequirements(BEARER_SCHEME)
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: `${DOCS_PATH}-json`,
  });
}
