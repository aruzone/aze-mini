import { HealthResponse as HealthResponseContract } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

// A response class carries no validation, only the shape: `implements` is what
// holds it to the contract the service answers with, the way a DTO's does for a
// request body. See ADR-0007.
export class HealthResponse implements HealthResponseContract {
  @ApiProperty({ example: 'Aze API Health OK' })
  message: string;
}
