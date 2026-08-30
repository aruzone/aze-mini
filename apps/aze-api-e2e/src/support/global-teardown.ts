import { killPort } from '@nx/node/utils';
import { API_PORT } from './api-port';
/* eslint-disable */

module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  // Kill whatever still holds the API port — including this run's own serve,
  // which can outlive the command that started it by a moment. Without this,
  // the next run's readiness check can pass against the dying server and then
  // find nothing there once jest starts asking questions.
  await killPort(API_PORT);
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
