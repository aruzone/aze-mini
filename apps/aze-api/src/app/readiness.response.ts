import { ApiProperty } from '@nestjs/swagger';
import {
  HealthCheckStatus,
  ReadinessResponse as ReadinessResponseContract,
} from '@aze-mini/platform-contracts';

// A response class carries no validation, only the shape: `implements` is what
// checks the fields against the contract, the decorators what the document
// shows. See ADR-0007.
export class ReadinessChecksResponse {
  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database: HealthCheckStatus;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  cache: HealthCheckStatus;
}

export class ReadinessResponse implements ReadinessResponseContract {
  @ApiProperty({ example: 'ready', enum: ['ready', 'not ready'] })
  status: 'ready' | 'not ready';

  @ApiProperty({ type: ReadinessChecksResponse, example: { database: 'up', cache: 'up' } })
  checks: ReadinessChecksResponse;
}
