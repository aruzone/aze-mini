import { ApiProperty } from '@nestjs/swagger';
import { LivenessResponse as LivenessResponseContract } from '@aze-mini/platform-contracts';

// A response class carries no validation, only the shape: `implements` is what
// checks the fields against the contract, the decorators what the document
// shows. See ADR-0007.
export class LivenessResponse implements LivenessResponseContract {
  @ApiProperty({ example: 'live' })
  status: 'live';
}
