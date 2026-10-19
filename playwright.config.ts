import { defineConfig } from '@playwright/test';
const PORT = 8090;
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined } },
  webServer: {
    command: `npx vite build && PORT=${PORT} ADMIN_PASSWORD=Admin-E2E-2026 npx tsx tests/dev-server.ts`,
    port: PORT, reuseExistingServer: false, timeout: 120_000,
  },
});
