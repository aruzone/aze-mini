/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { ApiExceptionFilter } from './config/filter/api-exception.filter';
import { validationPipe } from './config/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // CORS Enable for Frontend
  app.enableCors({
    origin: 'http://localhost:3000', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
  });

  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());

  // Read from appConfig rather than re-deriving process.env.PORT here — the
  // two defaults could otherwise drift apart.
  const port = app.get(ConfigService).get<number>('port');
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
