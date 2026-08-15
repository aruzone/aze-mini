/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { CACHE_STATUS_HEADER } from './cache/cache-status';
import { setupDocs } from './config/docs';
import { configurationProblems } from './config/configuration';
import { ApiExceptionFilter } from './config/filter/api-exception.filter';
import { validationPipe } from './config/pipes/validation.pipe';

// The environment is already complete here: `nx serve` loads apps/aze-api/.env
// into the task, and running the bundle directly from that directory has it
// loaded by ConfigModule.forRoot, which importing AppModule above has already
// run. Either way the check sees every value, and it runs before Prisma
// connects — so an unconfigured Starter says which variable is wrong instead of
// dying in a connect or on the first login a User attempts.
function isConfigured() {
  const problems = configurationProblems();
  if (problems.length === 0) {
    return true;
  }

  const logger = new Logger('Configuration');
  problems.forEach((problem) => logger.error(problem));
  logger.error('Refusing to start.');
  // Not process.exit: stderr to a pipe — which is what `nx serve` and Docker
  // give us — flushes asynchronously, and exiting here would discard the very
  // message this exists to print. Returning leaves the loop to drain first.
  process.exitCode = 1;
  return false;
}

async function bootstrap() {
  if (!isConfigured()) {
    return;
  }

  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // CORS Enable for Frontend
  app.enableCors({
    origin: 'http://localhost:3000', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
    // A browser hands script only the handful of headers it is told to. The
    // cached routes answer with X-Cache, and the client that reads them runs
    // in a browser, so saying nothing here would hide it from the one consumer
    // the Starter ships (ADR-0005).
    exposedHeaders: [CACHE_STATUS_HEADER],
  });

  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Read from appConfig rather than re-deriving process.env.PORT here — the
  // two defaults could otherwise drift apart.
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const docsEnabled = configService.get<boolean>('docsEnabled');

  const docsPath = docsEnabled ? setupDocs(app, globalPrefix) : undefined;

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  if (docsPath) {
    Logger.log(`📖 API documentation: http://localhost:${port}/${docsPath}`);
  }
}

bootstrap();
