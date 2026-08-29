import { Injectable } from '@nestjs/common';
import type { HealthCheckStatus, LivenessResponse, ReadinessResponse } from '@aze-mini/platform-contracts';
import { CacheService } from '../cache/cache.service';
import { DatabaseService } from '../database/database.service';

/**
 * What the probe routes answer with. Liveness consults nothing: a process
 * that answers is alive, and gating liveness on a dependency would have the
 * orchestrator restart a process whose only crime is a database that blinked.
 * Readiness gates on Postgres alone; the cache is reported, never gating,
 * because it fails open (ADR-0005) and a deployment without it still serves.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  liveness(): LivenessResponse {
    return { status: 'live' };
  }

  async readiness(): Promise<ReadinessResponse> {
    const checks = {
      database: await this.checkDatabase(),
      cache: await this.cache.check(),
    };

    return { status: checks.database === 'up' ? 'ready' : 'not ready', checks };
  }

  // `SELECT 1` rather than a Prisma model: readiness asks whether Postgres
  // answers at all, not whether any particular table is there.
  private async checkDatabase(): Promise<HealthCheckStatus> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
