import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_KEY_HEADER, API_KEY_SCHEME, BEARER_SCHEME } from './security';

/** Appended to the API's global prefix, which main.ts owns. */
export const DOCS_ROUTE = 'docs';

/**
 * Bearer auth is required document-wide, mirroring the global guard of
 * ADR-0002: a route is documented as protected unless a decorator says
 * otherwise, exactly as it is protected unless a decorator says otherwise.
 *
 * Returns the path it served on, so the caller can log one truth.
 */
export function setupDocs(app: INestApplication, globalPrefix: string) {
  const path = `${globalPrefix}/${DOCS_ROUTE}`;

  const config = new DocumentBuilder()
    .setTitle('Aze API')
    .setDescription(
      'Every route requires a bearer token unless it is marked otherwise. ' +
        'Register or log in, then paste the accessToken into Authorize to call the rest.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, BEARER_SCHEME)
    .addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, API_KEY_SCHEME)
    .addSecurityRequirements(BEARER_SCHEME)
    .build();

  SwaggerModule.setup(path, app, SwaggerModule.createDocument(app, config), {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: `${path}-json`,
  });

  return path;
}
