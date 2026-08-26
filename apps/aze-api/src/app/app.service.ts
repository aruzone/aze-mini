import { HealthResponse } from '@aze-mini/platform-contracts';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): HealthResponse {
    return { message: 'Aze API Health OK' };
  }
}
