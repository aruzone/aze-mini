import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app/app.module';
import { CACHE_STATUS_HEADER } from './cache/cache-status';
import { DOCS_ROUTE, setupDocs } from './config/docs';
import { configurationProblems } from './config/configuration';
import { ApiExceptionFilter } from './config/filter/api-exception.filter';
import { validationPipe } from './config/pipes/validation.pipe';
import { securityHeaders } from './config/security-headers';

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

  // Typed as the Express application it is, so `trust proxy` below is settable.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Read from appConfig rather than re-deriving process.env here — the two
  // defaults could otherwise drift apart.
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port');
  const docsEnabled = configService.get<boolean>('docsEnabled');
  const corsOrigins = configService.get<string | string[]>('corsOrigins');
  const trustProxy = configService.get<boolean | number | string>('trustProxy');

  // What Express believes about X-Forwarded-For, and so what `@Ip()` returns
  // and what login throttling counts. False by default: the header is
  // caller-supplied, and trusting it without a proxy in front hands an
  // attacker as many identities as they care to invent.
  app.set('trust proxy', trustProxy);

  // Before setupDocs, not after: Swagger registers its own Express route, and
  // Express runs handlers in the order they were added. Registering these
  // second would leave the one page a browser actually renders as the only
  // response with no security headers on it at all.
  const docsPath = `${globalPrefix}/${DOCS_ROUTE}`;
  app.use(securityHeaders(docsEnabled ? docsPath : undefined));

  if (docsEnabled) {
    setupDocs(app, globalPrefix);
  }

  app.enableCors({
    // From the environment, so a deployment permits its own origin without a
    // code change. Defaults to the client a local clone starts.
    origin: corsOrigins,
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

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  if (docsEnabled) {
    Logger.log(`📖 API documentation: http://localhost:${port}/${docsPath}`);
  }
}

bootstrap();
