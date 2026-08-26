import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /*
   * Both halves of the stack. These specs sign a real User in against the real
   * API, so starting only the client would test a login form against nothing.
   * Postgres and Redis are still the clone's own — `docker compose up -d` and a
   * seeded database are what these read from.
   */
  webServer: [
    {
      command: 'npx nx run aze-api:serve',
      url: 'http://localhost:3030/api',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
    {
      // `start` is a production build, and a production client refuses to guess
      // where the API is rather than quietly defaulting to localhost
      // (src/lib/api.ts). A deployment sets this, so this does too — inline,
      // because Playwright's `env` does not survive the hop through Nx.
      command: 'AZE_API_URL=http://localhost:3030/api npx nx run aze-client:start',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
  /*
   * The Google Chrome already installed on the machine, rather than Playwright's
   * own Chromium build — nothing here has to be downloaded before `nx e2e`
   * works. Add firefox or webkit projects if you want them; those do need
   * `npx playwright install`.
   */
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
