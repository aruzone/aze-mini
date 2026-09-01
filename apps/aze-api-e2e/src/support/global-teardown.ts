import { killPort } from '@nx/node/utils';
import { API_PORT } from './api-port';
import { cleanupE2ECatalogue } from './catalogue-cleanup';
/* eslint-disable */

module.exports = async function () {
  let catalogueFailure: unknown;
  let catalogueCleanupFailed = false;
  try {
    await cleanupE2ECatalogue();
  } catch (error) {
    catalogueFailure = error;
    catalogueCleanupFailed = true;
  }

  let portFailure: unknown;
  let portCleanupFailed = false;
  try {
    // Kill whatever still holds the API port — including this run's own serve,
    // which can outlive the command that started it by a moment. Without this,
    // the next run's readiness check can pass against the dying server and then
    // find nothing there once jest starts asking questions.
    await killPort(API_PORT);
  } catch (error) {
    portFailure = error;
    portCleanupFailed = true;
  }

  console.log(globalThis.__TEARDOWN_MESSAGE__);

  if (catalogueCleanupFailed && portCleanupFailed) {
    throw new AggregateError(
      [catalogueFailure, portFailure],
      'Catalogue and API port cleanup both failed',
    );
  }
  if (catalogueCleanupFailed) {
    throw catalogueFailure;
  }
  if (portCleanupFailed) {
    throw portFailure;
  }
};
