import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { LivenessResponse, ReadinessResponse } from '@aze-mini/platform-contracts';
import { ApiRefusal } from '../config/decorators/api-refusal.decorator';
import { Public } from '../config/decorators/public.decorator';
import { HealthService } from './health.service';
import { LivenessResponse as LivenessResponseBody } from './liveness.response';
import { ReadinessResponse as ReadinessResponseBody } from './readiness.response';

// Probes poll without a credential — there is nothing here to protect.
// Liveness answers from the process alone; readiness gates on Postgres alone,
// and says so in the document rather than leaving a caller to discover it.
// Probes never consume the throttle budget either: an orchestrator polling
// harder than the perimeter must not lock the pod out of its own health
// route, and a probe must never 503 because Redis is down.
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @ApiOkResponse({ description: 'The process is up', type: LivenessResponseBody })
  @Get('live')
  live(): LivenessResponse {
    return this.healthService.liveness();
  }

  @ApiOkResponse({ description: 'Postgres answers; the API can serve', type: ReadinessResponseBody })
  @ApiRefusal(HttpStatus.SERVICE_UNAVAILABLE, 'Postgres is not answering — the readiness body is not sent; the refusal envelope is')
  @Public()
  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const readiness = await this.healthService.readiness();

    // The refusal keeps the envelope every other refusal arrives in; what the
    // probes read is the status code, and that says enough by itself.
    if (readiness.status !== 'ready') {
      throw new ServiceUnavailableException('Postgres is not answering');
    }

    return readiness;
  }
}
