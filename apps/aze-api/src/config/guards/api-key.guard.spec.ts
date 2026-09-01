import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ConfigService } from '@nestjs/config';
import { API_KEY_HEADER } from '../security';
import { AuditService } from '../../audit/audit.service';

const requestCarrying = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as ExecutionContext;

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configured: jest.Mock;

  beforeEach(async () => {
    configured = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ConfigService, useValue: { get: configured } },
        { provide: AuditService, useValue: { appendBestEffort: jest.fn() } },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('admits the configured key', async () => {
    configured.mockReturnValue('a-real-key');

    await expect(
      guard.canActivate(requestCarrying({ [API_KEY_HEADER]: 'a-real-key' })),
    ).resolves.toBe(true);
  });

  // The mock answers to any name, so without this the guard could read a key
  // appConfig does not expose and every test here would still pass — while
  // POST /products refused everyone.
  it('reads the key appConfig exposes', async () => {
    configured.mockReturnValue('a-real-key');

    await guard.canActivate(requestCarrying({ [API_KEY_HEADER]: 'a-real-key' }));

    expect(configured).toHaveBeenCalledWith('apiKey');
  });

  it('refuses a key that does not match', async () => {
    configured.mockReturnValue('a-real-key');

    await expect(
      guard.canActivate(requestCarrying({ [API_KEY_HEADER]: 'guessed' })),
    ).rejects.toThrow(ForbiddenException);
  });

  // Configuration is checked before the Starter boots, so an unset key should
  // be unreachable. It is still refused here rather than compared: an absent
  // header equals an absent key, and comparing them would admit everyone
  // precisely when nothing was configured.
  it('refuses everything when no key is configured', async () => {
    configured.mockReturnValue(undefined);

    await expect(guard.canActivate(requestCarrying({}))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
