import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiRefusal } from '../config/decorators/api-refusal.decorator';
import { Public } from '../config/decorators/public.decorator';
import type { Request, Response } from 'express';
import { appConfig } from '../config/configuration';
import { AuthService } from './auth.service';
import { RefreshSessions } from './refresh-sessions';
import {
  REFRESH_COOKIE,
  SESSION_REFUSED,
  clearRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import { AuthResponse } from './auth.response';
import { AuthNoticeResponse } from './auth-notice.response';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshSessions: RefreshSessions,
  ) {}

  // Registration stays open (ADR-0010), but with a tighter per-source
  // throttle than the perimeter: creating User rows is the cheapest abuse of
  // a public write route. The ceiling is deployment configuration, read once
  // at class definition — the same value the startup check validated.
  @Throttle({
    default: {
      limit: appConfig().registrationsPerMinute,
      ttl: 60_000,
    },
  })
  @Public()
  @ApiCreatedResponse({ description: 'The User, and a token for them', type: AuthResponse })
  @ApiRefusal(HttpStatus.CONFLICT, 'That email is already registered')
  @Post('register')
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) reply: Response,
  ): Promise<AuthResponse> {
    const { auth, refreshToken } = await this.authService.register(input);
    this.setCookie(reply, refreshToken);
    return auth;
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
  async login(
    @Body() input: LoginDto,
    @Ip() source: string,
    @Res({ passthrough: true }) reply: Response,
  ): Promise<AuthResponse> {
    const { auth, refreshToken } = await this.authService.authenticate(input, source);
    this.setCookie(reply, refreshToken);
    return auth;
  }

  // Exchange a valid refresh cookie for a fresh access token and a rotated
  // refresh cookie (ADR-0009). The body stays empty: the credential travels in
  // the cookie, never in a request body a browser could log.
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'A fresh access token for the same User', type: AuthResponse })
  @ApiRefusal(HttpStatus.UNAUTHORIZED, SESSION_REFUSED)
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) reply: Response,
  ): Promise<AuthResponse> {
    const presented = this.presentedRefreshToken(request, reply);

    const { userId, refreshToken } = await this.refreshSessions.rotate(presented);
    this.setCookie(reply, refreshToken);
    return await this.authService.issueAccessTokenFor(userId);
  }

  // Revokes the presented family and clears the cookie. The client clears its
  // own cookies regardless of the answer, so a missing cookie still ends the
  // local session without pretending anything was revoked server-side.
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The session family was revoked', type: AuthNoticeResponse })
  @ApiRefusal(HttpStatus.UNAUTHORIZED, SESSION_REFUSED)
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) reply: Response,
  ): Promise<{ message: string }> {
    const presented = this.presentedRefreshToken(request, reply);

    await this.authService.logout(presented);
    clearRefreshCookie(reply);
    return { message: 'Signed out' };
  }

  // Enumeration-safe (ADR-0011): one identical answer, whether or not the
  // address is registered. The endpoint inherits the fail-closed perimeter
  // throttle, and the account is never locked by reset requests.
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The same answer either way', type: AuthNoticeResponse })
  @Post('forgot-password')
  async forgotPassword(@Body() input: ForgotPasswordDto): Promise<AuthNoticeResponse> {
    const notice = await this.authService.forgotPassword(input.email);
    return { message: notice.message };
  }

  // Answers 200 with the neutral envelope; an invalid or expired token is a
  // 400 from the service, not a hint about which tokens exist.
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The password was changed and every session was revoked', type: AuthNoticeResponse })
  @ApiRefusal(HttpStatus.BAD_REQUEST, 'This reset link is invalid or has expired.')
  @Post('reset-password')
  async resetPassword(@Body() input: ResetPasswordDto): Promise<AuthNoticeResponse> {
    const notice = await this.authService.resetPassword(input.token, input.password);
    return { message: notice.message };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The email address is now verified', type: AuthNoticeResponse })
  @ApiRefusal(HttpStatus.BAD_REQUEST, 'This verification link is invalid or has expired.')
  @Post('verify-email')
  async verifyEmail(@Body() input: VerifyEmailDto): Promise<AuthNoticeResponse> {
    const notice = await this.authService.verifyEmail(input.token);
    return { message: notice.message };
  }

  // Both cookie-bearing routes refuse the same way when nothing was
  // presented, and both clear the stale cookie on the way out so a browser
  // holding a dead token stops sending it.
  private presentedRefreshToken(request: Request, reply: Response): string {
    const presented = request.cookies?.[REFRESH_COOKIE];
    if (!presented) {
      clearRefreshCookie(reply);
      throw new UnauthorizedException(SESSION_REFUSED);
    }
    return presented;
  }

  // Read off appConfig, the same source the @Throttle above reads: these are
  // deployment configuration the startup check has already validated, and a
  // decorator cannot reach an injected ConfigService anyway. One source here
  // keeps the class from holding two answers to the same question.
  private setCookie(reply: Response, refreshToken: string): void {
    setRefreshCookie(reply, refreshToken, appConfig().refreshTokenTtlSeconds);
  }
}
