import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Public } from '../config/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  // The address is read here rather than in the service, so what counts as a
  // "source" stays a transport question. Behind a proxy it is only as good as
  // TRUST_PROXY — see src/config/configuration.ts.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() input: LoginDto, @Ip() source: string) {
    return this.authService.authenticate(input, source);
  }
}
