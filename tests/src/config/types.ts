export interface TestConfig {
  readonly api: {
    readonly baseUrl: string
    readonly timeoutMs: number
  }
  readonly ui: {
    readonly baseUrl: string
  }
  readonly auth: {
    readonly username: string
    readonly password: string
    readonly tenantId: string
  }
  readonly seed: {
    readonly accountPrefix: string
    readonly productPrefix: string
  }
}
