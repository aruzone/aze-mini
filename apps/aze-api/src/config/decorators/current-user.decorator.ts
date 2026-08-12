import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/token-claims';

/**
 * The User the token identifies. Only ever populated on a route the global
 * guard has already verified, so a route reading this cannot be anonymous.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest().user,
);
