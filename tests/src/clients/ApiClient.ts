import type { APIRequestContext, APIResponse } from '@playwright/test'
import type { Logger } from '../logger/Logger.js'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly method: string,
    public readonly url: string,
    public readonly body: unknown,
  ) {
    super(`[${method} ${url}] ${status} — ${message}`)
    this.name = 'ApiError'
  }
}

function extractMessage(parsed: unknown, fallback: string): string {
  if (parsed === null || parsed === undefined) return fallback
  if (typeof parsed === 'string') return parsed || fallback
  if (typeof parsed !== 'object') return String(parsed)
  const p = parsed as Record<string, unknown>
  if (typeof p.message === 'string') return p.message
  const detail = p.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (entry !== null && typeof entry === 'object') {
          const e = entry as { msg?: unknown; loc?: unknown }
          const loc = Array.isArray(e.loc) ? e.loc.join('.') : e.loc
          const msg = typeof e.msg === 'string' ? e.msg : JSON.stringify(entry)
          return loc ? `${loc}: ${msg}` : msg
        }
        return String(entry)
      })
      .join('; ')
  }
  if (detail !== undefined) return JSON.stringify(detail)
  return fallback
}

export interface ApiClientOptions {
  readonly baseUrl: string
  readonly logger: Logger
  readonly request: APIRequestContext
}

export abstract class ApiClient {
  protected readonly logger: Logger
  protected readonly baseUrl: string
  protected readonly request: APIRequestContext

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.logger = opts.logger
    this.request = opts.request
  }

  protected async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.send<T>('GET', this.urlWithParams(path, params))
  }

  protected async post<T>(path: string, body?: unknown): Promise<T> {
    return this.send<T>('POST', path, body)
  }

  protected async patch<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>('PATCH', path, body)
  }

  protected async del(path: string): Promise<void> {
    await this.send<void>('DELETE', path)
  }

  private urlWithParams(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    if (!params) return path
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      qs.set(key, String(value))
    }
    const query = qs.toString()
    return query ? `${path}?${query}` : path
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const started = Date.now()
    let response: APIResponse
    try {
      response = await this.request.fetch(url, {
        method,
        data: body === undefined ? undefined : body,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
    } catch (err) {
      this.logger.error(`Network error during ${method} ${url}`, { err: String(err) })
      throw err
    }
    const duration = Date.now() - started
    this.logger.request(method, path, response.status(), duration)

    if (!response.ok()) {
      const text = await response.text()
      let parsed: unknown = text
      try {
        parsed = JSON.parse(text)
      } catch { /* plain text */ }
      throw new ApiError(extractMessage(parsed, response.statusText()), response.status(), method, url, parsed)
    }

    if (response.status() === 204) return undefined as T
    const raw = await response.text()
    if (!raw) return undefined as T
    return JSON.parse(raw) as T
  }
}
