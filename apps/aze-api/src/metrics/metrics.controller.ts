import { Controller, Get, Header, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { contentType as metricsContentType } from 'prom-client';
import { ApiRefusal } from '../config/decorators/api-refusal.decorator';
import { Public } from '../config/decorators/public.decorator';
import { MetricsService } from './metrics.service';

// Probes and scrapers poll without a credential — the endpoint carries no
// User data, and turning it on is already a deliberate act (METRICS_ENABLED).
// A scraper polling every few seconds must not eat the throttle budget, and
// metrics must answer even while Redis is down.
@Controller('metrics')
@SkipThrottle()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}


  @Public()
  @ApiOkResponse({ description: 'The Prometheus exposition, in text format', content: { 'text/plain': { schema: { type: 'string' } } } })
  @ApiRefusal(HttpStatus.NOT_FOUND, 'Metrics are off — the endpoint refuses until METRICS_ENABLED=true')
  @Header('Content-Type', metricsContentType)
  @Public()
  @Get()
  async serve(): Promise<string> {
    if (!this.metrics.enabled) {
      throw new NotFoundException('Metrics are off — set METRICS_ENABLED=true to serve them');
    }

    return this.metrics.text();
  }
}
