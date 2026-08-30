import { ForgotPasswordRequest } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email: string;
}
