import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  const make = async (enabled: boolean) => {
    const config = {
      get: (key: string) => (key === 'metricsEnabled' ? enabled : undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService, { provide: ConfigService, useValue: config }],
    }).compile();

    return module.get<MetricsService>(MetricsService);
  };

  describe('when enabled', () => {
    let service: MetricsService;

    beforeEach(async () => {
      service = await make(true);
    });

    it('reports what was observed', async () => {
      service.observe('GET', '/api/products', 200, 0.01);

      const text = await service.text();
      expect(text).toContain('http_request_duration_seconds');
      expect(text).toMatch(
        /http_request_duration_seconds_count\{[^}]*method="GET"[^}]*status="200"/,
      );
    });

    it('carries the process metrics a scrape expects by default', async () => {
      expect(await service.text()).toContain('process_cpu_user_seconds_total');
    });
  });

  it('exposes nothing and records nothing when disabled', async () => {
    const service = await make(false);

    expect(service.enabled).toBe(false);
    service.observe('GET', '/api/products', 200, 0.01);

    const text = await service.text();
    expect(text).not.toContain('http_request_duration_seconds');
    expect(text).not.toContain('process_cpu_user_seconds_total');
  });
});
