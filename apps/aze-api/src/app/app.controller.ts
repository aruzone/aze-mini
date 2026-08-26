import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../config/decorators/public.decorator';
import { AppService } from './app.service';
import { HealthResponse } from './health.response';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @ApiOkResponse({ description: 'The API is up', type: HealthResponse })
  @Get()
  getData() {
    return this.appService.getData();
  }
}
