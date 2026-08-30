import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../config/decorators/public.decorator';
import { AppService } from './app.service';
import { HealthResponse } from './health.response';

// The healthcheck and chart probes call this route. It never consumes the
// throttle budget, so a busy orchestrator cannot lock a pod out of it.
@Controller()
@SkipThrottle()
export class AppController {
  constructor(private readonly appService: AppService) {}


  @Public()
  @ApiOkResponse({ description: 'The API is up', type: HealthResponse })
  @Get()
  getData() {
    return this.appService.getData();
  }
}
