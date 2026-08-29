import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Records one histogram observation per request.
 *
 * The observation happens on the response's `finish`, not when the handler
 * returns: the status a response finally carries is written by the exception
 * filter, which runs after every interceptor and middleware has been seen
 * through. Recording earlier would file every refusal under a status it
 * never sent.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction) {
    if (!this.metrics.enabled) {
      next();
      return;
    }

    const started = process.hrtime.bigint();

    response.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      // The route pattern, not the URL: an id in the path would give the
      // histogram one series per row instead of one per endpoint.
      const route = response.req?.route?.path ?? 'unmatched';
      this.metrics.observe(request.method, route, response.statusCode, seconds);
    });

    next();
  }
}
