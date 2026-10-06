import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.saucedemo.com',
    // SauceDemo exposes stable `data-test` hooks; map getByTestId() to them.
    testIdAttribute: 'data-test',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Set PW_CHANNEL=chrome to run against an installed Google Chrome instead of the bundled build.
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL },
    },
  ],
});
