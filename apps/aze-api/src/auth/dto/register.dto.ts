import { RegisterRequest } from '@aze-mini/platform-contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email: string;

  // Length is checked in AuthService, which knows the bytes bcrypt will read.
  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
