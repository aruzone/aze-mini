import axios from 'axios';
import Redis from 'ioredis';
import { API_HOST, API_PORT } from './api-port';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

const delay = (ms: number): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
};

module.exports = async function () {
  console.log('\nSetting up...\n');

  // A bare TCP connect is not enough: the previous run's server, caught
  // mid-shutdown, still has its listening socket open — the kernel accepts
  // into the backlog while nobody reads — so a port wait would pass and every
  // request below would find a socket nobody serves. The liveness route
  // answering 200 is the difference between a port and an API.
  const live = `http://${API_HOST}:${API_PORT}/api/health/live`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get(live, { timeout: 1_000 });
      if (res.status === 200) {
        break;
      }
    } catch {
      if (attempt >= 120) {
        throw new Error(`The API never answered 200 at ${live}`);
      }
    }
    await delay(250);
  }

  // CI answers against a Redis that was born with this run, so the login
  // limiter's counters start at zero. A local run reuses one Redis across
  // many runs, and the per-source failure counter (15-minute window) would
  // poison every sign-in the suite attempts once a few runs have accumulated.
  // Deleting what the limiter wrote puts the local run where CI already is:
  // fresh. Everything else in Redis — the cache — is content to stay.
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const keys = await redis.keys('login:fail:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
