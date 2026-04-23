import { ConfidentialClientApplication } from '@azure/msal-node'
import type { APIRequestContext } from '@playwright/test'
import type { Logger } from '../logger/Logger.js'

export interface RawResponse<T = unknown> {
  readonly status: number
  readonly ok: boolean
  readonly headers: Readonly<Record<string, string>>
  readonly body: T | null
  readonly rawText: string
}

export interface TokenInfo {
  readonly accessToken: string
  readonly expiresOn: Date | null
  readonly tokenType: string | null
}

/**
 * Minimal OData client talking directly to Dataverse Web API, bypassing
 * our FastAPI backend entirely. Used by the `dataverse` Playwright project
 * to contract-test the Microsoft surface our whole stack rests on.
 *
 * Acquires bearer tokens via MSAL-node (@azure/msal-node) with the
 * client-credentials flow, same as our Python backend uses.
 */
export class DataverseRawClient {
  private msal?: ConfidentialClientApplication
  private cachedToken?: { value: string; expiresAtMs: number }

  constructor(
    public readonly baseUrl: string,
    private readonly tenantId: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly request: APIRequestContext,
    private readonly logger: Logger,
  ) {}

  get apiBase(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/api/data/v9.2`
  }

  get scope(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/.default`
  }

  get authority(): string {
    return `https://login.microsoftonline.com/${this.tenantId}`
  }

  async acquireToken(): Promise<TokenInfo> {
    const msal = this.getMsal()
    const result = await msal.acquireTokenByClientCredential({
      scopes: [this.scope],
    })
    if (!result?.accessToken) {
      throw new Error('MSAL acquireTokenByClientCredential returned no access token')
    }
    return {
      accessToken: result.accessToken,
      expiresOn: result.expiresOn ?? null,
      tokenType: result.tokenType ?? null,
    }
  }

  async fetch<T = unknown>(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<RawResponse<T>> {
    const token = await this.ensureToken()
    const url = path.startsWith('http') ? path : `${this.apiBase}${path}`

    const started = Date.now()
    const response = await this.request.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers ?? {}),
      },
      data: opts.body === undefined ? undefined : opts.body,
    })
    const duration = Date.now() - started
    this.logger.request(method, path, response.status(), duration)

    const rawText = await response.text()
    let body: unknown = null
    if (rawText) {
      try {
        body = JSON.parse(rawText)
      } catch {
        body = rawText
      }
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(response.headers())) {
      headers[key.toLowerCase()] = value
    }

    return {
      status: response.status(),
      ok: response.ok(),
      headers,
      body: body as T | null,
      rawText,
    }
  }

  get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<RawResponse<T>> {
    const url = params ? `${path}${buildQuery(params)}` : path
    return this.fetch<T>('GET', url)
  }

  post<T = unknown>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<RawResponse<T>> {
    return this.fetch<T>('POST', path, { body, headers })
  }

  patch<T = unknown>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<RawResponse<T>> {
    return this.fetch<T>('PATCH', path, { body, headers })
  }

  delete(path: string): Promise<RawResponse> {
    return this.fetch('DELETE', path)
  }

  private getMsal(): ConfidentialClientApplication {
    if (!this.msal) {
      this.msal = new ConfidentialClientApplication({
        auth: {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
          authority: this.authority,
        },
      })
    }
    return this.msal
  }

  private async ensureToken(): Promise<string> {
    const now = Date.now()
    if (this.cachedToken && this.cachedToken.expiresAtMs - 60_000 > now) {
      return this.cachedToken.value
    }
    const info = await this.acquireToken()
    const expiresAtMs = info.expiresOn?.getTime() ?? now + 3600_000
    this.cachedToken = { value: info.accessToken, expiresAtMs }
    return info.accessToken
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}
