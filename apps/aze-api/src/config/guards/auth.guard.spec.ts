import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../auth/auth.service';
import { RefreshSessions } from '../../auth/refresh-sessions';
import { EmailTokens } from '../../auth/email-tokens';
import { MailSender } from '../../mail/mail-sender';
import { REDIS_CLIENT } from '../../config/redis-client';
import { LoginAttempts } from '../../auth/login-attempts';
import { UsersService } from '../../users/users.service';
import { MachineToMachine } from '../decorators/machine-to-machine.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthGuard } from './auth.guard';
import { AuditService } from '../../audit/audit.service';

const JWT_SECRET = 'test-secret';

type RequestWithUser = {
  headers: Record<string, string>;
  user?: Record<string, unknown>;
};

// Routes carrying the real decorators, so the guard is read through the same
// metadata a controller would set rather than through a hand-built stub.
class DemoController {
  @Public()
  anonymous() {
    return null;
  }

  @MachineToMachine()
  machine() {
    return null;
  }

  guarded() {
    return null;
  }
}

function requestWith(token: string): RequestWithUser {
  return { headers: { authorization: `Bearer ${token}` } };
}

function contextFor(
  request: RequestWithUser,
  handler: keyof DemoController = 'guarded',
) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => DemoController.prototype[handler],
    getClass: () => DemoController,
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
        LoginAttempts,
        Reflector,
        { provide: UsersService, useValue: { findUserByEmail: jest.fn() } },
        { provide: RefreshSessions, useValue: { issue: jest.fn(async () => 'refresh-token') } },
        { provide: EmailTokens, useValue: { issue: jest.fn(async () => 'email-token') } },
        { provide: MailSender, useValue: { send: jest.fn(async () => undefined) } },
        { provide: AuditService, useValue: { appendBestEffort: jest.fn() } },
        {
          provide: REDIS_CLIENT,
          useValue: {
            get: async () => null,
            incr: async () => 1,
            pexpire: async () => 1,
            pttl: async () => -1,
            del: async () => 1,
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    authService = module.get<AuthService>(AuthService);
  });

  // The token comes from AuthService rather than from a payload this spec
  // invents, so a claim renamed on the signing side fails here instead of
  // quietly reappearing as an undefined field on the request context.
  async function issuedToken() {
    const { auth } = await authService.login({
      userId: 'user-1',
      email: 'ada@example.com',
      verifiedAt: null,
    });
    return auth.accessToken;
  }

  it('exposes the claims the token actually carries', async () => {
    const request = requestWith(await issuedToken());

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toEqual({ userId: 'user-1', email: 'ada@example.com', verified: false });
  });

  // A key that is always undefined is worse than a missing one: it reads as a
  // usable identity to whoever builds authorization on this context.
  it('exposes no claim the token does not carry', async () => {
    const request = requestWith(await issuedToken());

    await guard.canActivate(contextFor(request));

    expect(Object.keys(request.user ?? {})).toEqual(['userId', 'email', 'verified']);
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

  it('protects a route that opts out of nothing', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request, 'guarded'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lets an anonymous route through without a token', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request, 'anonymous'))).resolves.toBe(
      true,
    );
    expect(request.user).toBeUndefined();
  });

  // The key guard authenticates this one; stacking JWT on top would demand two
  // credentials from a caller that has no User to log in as.
  it('stands down on a machine-to-machine route', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request, 'machine'))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
});
