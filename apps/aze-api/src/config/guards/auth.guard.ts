import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
      const tokenPayload = await this.jwtService.verifyAsync(token);
      // Only claims AuthService.login signs. Anything else reads as an identity
      // to whoever builds authorization on this context, but is always undefined.
      request.user = {
        userId: tokenPayload.sub,
        email: tokenPayload.email,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
