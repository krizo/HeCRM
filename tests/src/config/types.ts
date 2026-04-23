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
  readonly dataverse: {
    // Direct Dataverse Web API credentials. All four must be set for the
    // `dataverse` Playwright project to run — otherwise its specs skip
    // with a clear message.
    readonly url: string
    readonly tenantId: string
    readonly clientId: string
    readonly clientSecret: string
  }
  readonly seed: {
    readonly accountPrefix: string
    readonly productPrefix: string
  }
}
