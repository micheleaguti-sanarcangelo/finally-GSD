import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    headless: true,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  workers: 1,
});
