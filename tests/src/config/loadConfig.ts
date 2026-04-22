import type { TestConfig } from './types.js'

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function loadConfig(): TestConfig {
  return {
    api: {
      baseUrl: env('HECRM_API_BASE_URL', 'http://127.0.0.1:8000/api'),
      timeoutMs: Number(env('HECRM_REQUEST_TIMEOUT_MS', '30000')),
    },
    ui: {
      baseUrl: env('HECRM_UI_BASE_URL', 'http://127.0.0.1:5173'),
    },
    auth: {
      username: env('HECRM_AUTH_USERNAME', ''),
      password: env('HECRM_AUTH_PASSWORD', ''),
      tenantId: env('HECRM_AUTH_TENANT_ID', ''),
    },
    seed: {
      accountPrefix: env('HECRM_ACCOUNT_PREFIX', 'HECRM-'),
      productPrefix: env('HECRM_PRODUCT_PREFIX', 'HCR-'),
    },
  }
}
