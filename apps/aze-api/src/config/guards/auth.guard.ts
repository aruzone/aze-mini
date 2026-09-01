import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, TokenClaims } from '../../auth/token-claims';
import { IS_MACHINE_TO_MACHINE } from '../decorators/machine-to-machine.decorator';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { AuditService } from '../../audit/audit.service';
import type { Request } from 'express';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.optsOut(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers['authorization']; // "Bearer token..."
    const token = authorization?.split(' ')[1];

    if (!token) {
      return this.refuse(request, 'No token provided', 'missing_token');
    }

    try {
      const claims = await this.jwtService.verifyAsync<TokenClaims>(token);
      const user: AuthenticatedUser = {
        userId: claims.sub,
        email: claims.email,
        verified: claims.verified,
      };
      request.user = user;
      return true;
    } catch {
      return this.refuse(request, 'Invalid token', 'invalid_token');
    }
  }

  // A route opts out by carrying a decorator, so a route carrying none is
  // protected — the guard is global and this is the only way past it.
  private optsOut(context: ExecutionContext) {
    return [IS_PUBLIC, IS_MACHINE_TO_MACHINE].some((key) =>
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }

  private async refuse(
    request: AuthenticatedRequest,
    message: string,
    reason: string,
  ): Promise<never> {
    await this.audit.appendBestEffort({
      event: 'authz.refused',
      actorUserId: null,
      subjectType: 'HttpRequest',
      subjectId: `${request.method ?? 'UNKNOWN'} ${
        request.originalUrl?.split('?')[0] ?? 'unknown'
      }`,
      details: { reason },
    });
    throw new UnauthorizedException(message);
  }
}
