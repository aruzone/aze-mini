import { AuthResponse as AuthResponseContract, Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponse implements Wire<AuthResponseContract> {
  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  userId: string;

  @ApiProperty({ example: 'ada@example.com' })
  email: string;

  @ApiProperty({
    description: 'Bearer token, valid for one day. Paste it into Authorize',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;
}
