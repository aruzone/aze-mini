import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

// The registry is one per process by design: a replica that collected into a
// shared place would need a scraper per replica anyway, and Prometheus is
// pull-based — it discovers the replicas itself.
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, MetricsMiddleware],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('{*splat}');
  }
}
