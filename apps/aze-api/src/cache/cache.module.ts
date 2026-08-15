import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { createRedisStore } from './redis-store';

/**
 * Caching is Redis and only Redis, for the same reason the database is Postgres
 * and only Postgres (ADR-0001): an in-memory cache is a different cache in
 * every replica, and the Starter is meant to survive being scaled past one.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        stores: [createRedisStore(configService.get<string>('redisUrl'))],
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
