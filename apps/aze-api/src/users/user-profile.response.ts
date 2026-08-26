import { UserProfile as UserProfileContract, Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

// Read through Wire, so the dates are documented as the strings JSON delivers
// rather than as the Date the contract names. No password field exists here
// because none exists in the contract, and none is read into one.
export class UserProfile implements Wire<UserProfileContract> {
  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'ada@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'Ada' })
  name: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  updatedAt: string;
}
