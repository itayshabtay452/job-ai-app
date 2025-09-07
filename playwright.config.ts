// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',                              // ספריית הבסיס למבחני Playwright
  testMatch: ['**/smoke/**/*.spec.ts'],          // רק מבחני smoke
  testIgnore: ['**/unit/**', '**/integration/**'], // מתעלמים ממבחני Vitest
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: {
    // מריץ את Next במצב dev כדי לא לדרוש build
    command: 'pnpm dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
