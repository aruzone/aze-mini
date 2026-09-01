import { killPort } from '@nx/node/utils';
import { API_PORT } from './api-port';
import { cleanupE2ECatalogue } from './catalogue-cleanup';

async function cleanupApiPort(): Promise<void> {
  // Kill whatever still holds the API port — including this run's own serve,
  // which can outlive the command that started it by a moment. Without this,
  // the next run's readiness check can pass against the dying server and then
  // find nothing there once jest starts asking questions.
  await killPort(API_PORT);
}

async function collectCleanupFailure(
  failures: unknown[],
  cleanup: () => Promise<void>,
): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    failures.push(error);
  }
}

module.exports = async function () {
  const cleanupFailures: unknown[] = [];

  await collectCleanupFailure(cleanupFailures, cleanupE2ECatalogue);
  await collectCleanupFailure(cleanupFailures, cleanupApiPort);

  console.log(globalThis.__TEARDOWN_MESSAGE__);

  if (cleanupFailures.length === 1) {
    throw cleanupFailures[0];
  }
  if (cleanupFailures.length > 1) {
    throw new AggregateError(
      cleanupFailures,
      'Catalogue and API port cleanup both failed',
    );
  }
};
