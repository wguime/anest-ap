import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — ANEST e2e
 *
 * Pre-req:
 *   - `npx playwright install` (one-time, ~250MB browsers download)
 *   - dev server running before running specs: `npm run dev`
 *   - env: E2E_BASE_URL (default http://localhost:5173), E2E_USER_EMAIL, E2E_USER_PASSWORD
 *
 * Run:
 *   npm run e2e              # headless, all specs
 *   npm run e2e:ui           # Playwright UI mode (debug)
 *   npm run e2e -- e2e/auth.spec.ts   # single spec
 *
 * Note: webServer block is intentionally commented out — start `npm run dev`
 * in a separate terminal before running e2e. This avoids races with Vite HMR
 * and Firebase Auth cold-start.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },
});
