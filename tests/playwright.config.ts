import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '.env') })

const apiBaseUrl = process.env.HECRM_API_BASE_URL ?? 'http://127.0.0.1:8000/api'
const uiBaseUrl = process.env.HECRM_UI_BASE_URL ?? 'http://127.0.0.1:5173'

// Headless is the default (fast, CI-friendly). Set HECRM_HEADLESS=false to
// watch the browser drive the app — useful for debugging a flaky UI step.
const headless = process.env.HECRM_HEADLESS !== 'false'

// Optional slow-motion for debugging: HECRM_SLOWMO_MS=500 inserts a 500ms
// delay between every UI action so you can follow along.
const slowMo = Number(process.env.HECRM_SLOWMO_MS ?? 0)

export default defineConfig({
  testDir: path.resolve(__dirname),
  fullyParallel: false,                // journeys mutate shared Dataverse data
  forbidOnly: !!process.env.CI,
  retries: Number(process.env.HECRM_DEFAULT_RETRIES ?? 0),
  workers: 1,
  timeout: 60_000,
  reporter: [
    // JourneyReporter owns stdout: it prints its own summary plus
    // forwards worker stdout/stderr via onStdOut/onStdErr, so exactly
    // one reporter writes each line — no chance of duplicated log
    // entries the way combined built-in reporters sometimes produce.
    ['./src/reporters/JourneyReporter.ts'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    headless,
    launchOptions: { slowMo },
  },
  projects: [
    {
      name: 'api',
      testDir: path.resolve(__dirname, 'api'),
      testMatch: /.*\.api\.spec\.ts/,
      use: { baseURL: apiBaseUrl },
    },
    {
      name: 'ui',
      testDir: path.resolve(__dirname, 'ui'),
      testMatch: /.*\.ui\.spec\.ts/,
      use: { baseURL: uiBaseUrl },
    },
    {
      // Contract tests against the raw Dataverse Web API. Auto-skip
      // when HECRM_DATAVERSE_* / HECRM_AZURE_* credentials are missing.
      name: 'dataverse',
      testDir: path.resolve(__dirname, 'dataverse'),
      testMatch: /.*\.dv\.spec\.ts/,
    },
  ],
})
