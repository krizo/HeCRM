import type { DataverseRawClient } from '../clients/DataverseRawClient.js'
import type { Logger } from '../logger/Logger.js'

interface TrackedResource {
  readonly entitySet: string
  readonly id: string
  readonly label?: string
}

/**
 * Sibling of `DataCollector` for the `dataverse` Playwright project.
 * Same track-and-teardown-cleanup pattern, but deletes via the raw
 * Dataverse Web API instead of routing through HeCRM's FastAPI.
 *
 * Cleanup iterates in reverse registration order, mirroring the rough
 * "children first" shape that the creation sequence usually produces.
 */
export class DataverseCollector {
  private readonly resources: TrackedResource[] = []

  constructor(
    private readonly dv: DataverseRawClient,
    private readonly logger: Logger,
  ) {}

  track(entitySet: string, id: string, label?: string): void {
    this.resources.push({ entitySet, id, label })
  }

  size(): number {
    return this.resources.length
  }

  async cleanup(): Promise<void> {
    if (this.resources.length === 0) {
      this.logger.debug('cleanup: nothing to delete')
      return
    }
    this.logger.info(`cleanup: removing ${this.resources.length} tracked resource(s)`)
    let failed = 0
    for (const r of [...this.resources].reverse()) {
      try {
        const response = await this.dv.delete(`/${r.entitySet}(${r.id})`)
        if (!response.ok && response.status !== 404) {
          failed += 1
          this.logger.warn(
            `cleanup ✗ ${r.entitySet} ${r.label ?? r.id}: ${response.status}`,
            response.body,
          )
        } else {
          this.logger.debug(`cleanup ✓ ${r.entitySet} ${r.label ?? r.id}`)
        }
      } catch (err) {
        failed += 1
        this.logger.warn(`cleanup ✗ ${r.entitySet} ${r.label ?? r.id}`, { err: String(err) })
      }
    }
    if (failed > 0) {
      this.logger.warn(`cleanup finished with ${failed} failure(s) — inspect Dataverse manually`)
    }
  }
}
