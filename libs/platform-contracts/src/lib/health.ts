/** What `GET /` answers with: the health route the probes and the healthcheck call. */
export type HealthResponse = {
  message: string;
};

/**
 * What `GET /api/health/live` answers with: the process is up and taking
 * requests. No dependency is consulted — a process that answers is alive.
 */
export type LivenessResponse = {
  status: 'live';
};

/** The state one dependency reports in a readiness response. */
export type HealthCheckStatus = 'up' | 'down';

/**
 * What `GET /api/health/ready` answers with. Only the database gates readiness;
 * the cache is reported but never gates it, because the cache fails open
 * (ADR-0005) and a deployment without its cache still serves.
 */
export type ReadinessResponse = {
  status: 'ready' | 'not ready';
  checks: {
    database: HealthCheckStatus;
    cache: HealthCheckStatus;
  };
};
