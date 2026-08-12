import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, TokenClaims } from '../../auth/token-claims';
import { IS_MACHINE_TO_MACHINE } from '../decorators/machine-to-machine.decorator';
import { IS_PUBLIC } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ) {
    if (this.optsOut(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization']; // "Bearer token..."
    const token = authorization?.split(' ')[1];

    if(!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const claims = await this.jwtService.verifyAsync<TokenClaims>(token);
      const user: AuthenticatedUser = { userId: claims.sub, email: claims.email };
      request.user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
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
}
