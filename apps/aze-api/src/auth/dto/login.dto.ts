import { LoginRequest } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// The shape is the contract's; what is declared here is only how a request is
// checked against it and how the document describes it. A field added to
// LoginRequest and not to this class is a compile error, not a silent 400.
export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
