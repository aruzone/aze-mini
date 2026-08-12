import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, TokenClaims } from '../../auth/token-claims';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(
    context: ExecutionContext,
  ) {
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
}
