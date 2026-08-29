import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AuthGuard } from '../config/guards/auth.guard';
import { AppService } from './app.service';
import { ProductsModule } from '../product/products/products.module';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from '../config/configuration';
import { loggingModule } from '../config/logging';
import { MetricsModule } from '../metrics/metrics.module';
import { ApiExceptionFilter } from '../config/filter/api-exception.filter';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig]
    }),
    loggingModule(),
    CacheModule,
    MetricsModule,
    ProductsModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    HealthService,
    ApiExceptionFilter,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
