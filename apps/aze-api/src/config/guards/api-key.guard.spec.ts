import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyGuard } from './api-key.guard';
import { ConfigService } from '@nestjs/config';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
