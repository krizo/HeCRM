const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = await response.text()
    }
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : typeof body === 'object' && body && 'detail' in body
          ? String((body as { detail: unknown }).detail)
          : response.statusText
    throw new ApiError(msg, response.status, body)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const str = search.toString()
  return str ? `?${str}` : ''
}
