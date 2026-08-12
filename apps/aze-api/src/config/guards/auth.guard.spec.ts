import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../auth/auth.service';
import { UsersService } from '../../users/users.service';
import { AuthGuard } from './auth.guard';

const JWT_SECRET = 'test-secret';

type RequestWithUser = {
  headers: Record<string, string>;
  user?: Record<string, unknown>;
};

function requestWith(token: string): RequestWithUser {
  return { headers: { authorization: `Bearer ${token}` } };
}

function contextFor(request: RequestWithUser) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        AuthGuard,
        AuthService,
        { provide: UsersService, useValue: { findUserByEmail: jest.fn() } },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    authService = module.get<AuthService>(AuthService);
  });

  // The token comes from AuthService rather than from a payload this spec
  // invents, so a claim renamed on the signing side fails here instead of
  // quietly reappearing as an undefined field on the request context.
  async function issuedToken() {
    const { accessToken } = await authService.login({
      userId: 'user-1',
      email: 'ada@example.com',
    });
    return accessToken;
  }

  it('exposes the claims the token actually carries', async () => {
    const request = requestWith(await issuedToken());

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toEqual({ userId: 'user-1', email: 'ada@example.com' });
  });

  // A key that is always undefined is worse than a missing one: it reads as a
  // usable identity to whoever builds authorization on this context.
  it('exposes no claim the token does not carry', async () => {
    const request = requestWith(await issuedToken());

    await guard.canActivate(contextFor(request));

    expect(Object.keys(request.user ?? {})).toEqual(['userId', 'email']);
    expect(Object.values(request.user ?? {})).not.toContain(undefined);
  });

  it('rejects a request carrying no token', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JwtService({ secret: 'another-secret' });
    const request = requestWith(foreign.sign({ email: 'mallory@example.com', sub: 'user-2' }));

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('leaves an unauthenticated request with no identity attached', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow();
    expect(request.user).toBeUndefined();
  });
});
