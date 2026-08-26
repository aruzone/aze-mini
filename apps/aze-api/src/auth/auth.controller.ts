import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { ApiRefusal } from '../config/decorators/api-refusal.decorator';
import { Public } from '../config/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponse } from './auth.response';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @ApiCreatedResponse({ description: 'The User, and a token for them', type: AuthResponse })
  @ApiRefusal(HttpStatus.CONFLICT, 'That email is already registered')
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  // The address is read here rather than in the service, so what counts as a
  // "source" stays a transport question. Behind a proxy it is only as good as
  // TRUST_PROXY — see src/config/configuration.ts.
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The User, and a token for them', type: AuthResponse })
  @ApiRefusal(HttpStatus.UNAUTHORIZED, 'Invalid credentials')
  @ApiRefusal(HttpStatus.TOO_MANY_REQUESTS, 'Too many failed attempts from this source')
  @Post('login')
  login(@Body() input: LoginDto, @Ip() source: string) {
    return this.authService.authenticate(input, source);
  }
}
