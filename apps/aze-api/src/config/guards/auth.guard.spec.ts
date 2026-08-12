import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';

// A real JwtService, so the claims under test are the ones AuthService signs
// rather than the ones a mock was told to return.
const JWT_SECRET = 'test-secret';

type RequestWithUser = {
  headers: Record<string, string>;
  user?: Record<string, unknown>;
};

function contextFor(request: RequestWithUser) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [AuthGuard],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('exposes the claims the token actually carries', async () => {
    const token = jwtService.sign({ email: 'ada@example.com', sub: 'user-1' });
    const request: RequestWithUser = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toEqual({ userId: 'user-1', email: 'ada@example.com' });
  });

  // The context is what an Adopter builds authorization on, so a key that is
  // always undefined is worse than a missing one: it reads as a usable identity.
  it('exposes no claim the token does not carry', async () => {
    const token = jwtService.sign({ email: 'ada@example.com', sub: 'user-1' });
    const request: RequestWithUser = { headers: { authorization: `Bearer ${token}` } };

    await guard.canActivate(contextFor(request));

    for (const [claim, value] of Object.entries(request.user ?? {})) {
      expect([claim, value]).not.toEqual([claim, undefined]);
    }
  });

  it('rejects a request carrying no token', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JwtService({ secret: 'another-secret' });
    const token = foreign.sign({ email: 'mallory@example.com', sub: 'user-2' });
    const request: RequestWithUser = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
