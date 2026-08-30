import { VerifyEmailRequest } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto implements VerifyEmailRequest {
  @ApiProperty({ description: 'The token from the verification email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
