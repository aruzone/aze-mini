import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/**
 * The one place the API keeps a metrics registry.
 *
 * Opt-in: `METRICS_ENABLED=true` is what turns collection and the endpoint on,
 * the same posture as `API_DOCS` — a metrics page names routes and carries
 * process internals, which is not something to publish by accident. When the
 * variable is absent the registry stays empty, nothing is recorded, and the
 * endpoint refuses; there is no half-on state to reason about.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();
  private readonly httpDuration: Histogram<string> | undefined;

  constructor(configService: ConfigService) {
    if (!configService.get<boolean>('metricsEnabled')) {
      return;
    }

    // The metrics a scrape expects before it asks for anything custom:
    // process memory, event-loop lag, GC — and, via the Node runtime
    // collector, the handle counts an Adopter will page on first.
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'How long the API took to answer, by route pattern, method and status',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });
  }

  get enabled(): boolean {
    return this.httpDuration !== undefined;
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    this.httpDuration?.observe({ method, route, status: String(status) }, seconds);
  }

  text(): Promise<string> {
    return this.registry.metrics();
  }
}
