import { ResetPasswordRequest } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ description: 'The token from the reset email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
