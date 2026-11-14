import { defineConfig, devices } from '@playwright/test';

/**
 * The same website in Chromium, Firefox and WebKit (the engine of Safari and every iPhone browser),
 * at phone size. The tests are in browser-tests; the faster Edge/Chrome suites in ../tests/e2e
 * (Windows only) cover the real backend and accounts.
 *
 *   npm run build && npm run test:browsers
 */
export default defineConfig({
  testDir: './browser-tests',
  outputDir: './node_modules/.cache/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    // The built site (the demo build: no backend), served with the production headers.
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium (Android)', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 390, height: 844 } } },
    { name: 'webkit (iPhone)', use: { ...devices['iPhone 14'] } },
  ],
});
