import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AuthGuard } from '../config/guards/auth.guard';
import { AppService } from './app.service';
import { loggingModule } from '../config/logging';
import { RedisClientModule } from '../config/redis-client';
import { throttlingModule } from '../config/throttling';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from '../config/configuration';
import { ProductsModule } from '../product/products/products.module';
import { MetricsModule } from '../metrics/metrics.module';
import { ApiExceptionFilter } from '../config/filter/api-exception.filter';
import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    loggingModule(),
    RedisClientModule,
    throttlingModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig]
    }),
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
    // The throttler runs before the auth guard: an unauthenticated flood is
    // exactly the traffic the perimeter exists to absorb (ADR-0010).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
