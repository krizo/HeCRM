import type { HeCrmApi } from '../clients/HeCrmApi.js'
import type { Logger } from '../logger/Logger.js'

type ResourceKind = 'account' | 'contact' | 'opportunity' | 'salesorder' | 'salesorderline'

interface TrackedResource {
  kind: ResourceKind
  id: string
  label?: string
  orderId?: string  // for salesorderline
}

/**
 * Tracks resources created during a test so we can clean them up in teardown.
 * Dependency order is encoded in the `cleanup()` method so e.g. order lines
 * are deleted before their parent order, opportunities before their account.
 */
export class DataCollector {
  private readonly resources: TrackedResource[] = []

  constructor(
    private readonly api: HeCrmApi,
    private readonly logger: Logger,
  ) {}

  track(kind: ResourceKind, id: string, label?: string, orderId?: string): void {
    this.resources.push({ kind, id, label, orderId })
  }

  size(): number {
    return this.resources.length
  }

  async cleanup(): Promise<void> {
    if (this.resources.length === 0) {
      this.logger.debug('cleanup: nothing to delete')
      return
    }
    const order: ResourceKind[] = [
      'salesorderline',
      'salesorder',
      'opportunity',
      'contact',
      'account',
    ]
    this.logger.info(`cleanup: removing ${this.resources.length} tracked resources`)
    let failed = 0
    for (const kind of order) {
      // newest first — account children were typically created AFTER the account
      const batch = this.resources.filter((r) => r.kind === kind).reverse()
      for (const r of batch) {
        try {
          await this.deleteOne(r)
          this.logger.debug(`cleanup ✓ ${kind} ${r.label ?? r.id}`)
        } catch (err) {
          failed += 1
          this.logger.warn(`cleanup ✗ ${kind} ${r.label ?? r.id}`, { err: String(err) })
        }
      }
    }
    if (failed > 0) {
      this.logger.warn(`cleanup finished with ${failed} failure(s) — inspect Dataverse manually`)
    }
  }

  private async deleteOne(r: TrackedResource): Promise<void> {
    switch (r.kind) {
      case 'account':
        return this.api.accounts.delete(r.id)
      case 'contact':
        return this.api.contacts.delete(r.id)
      case 'opportunity':
        return this.api.opportunities.delete(r.id)
      case 'salesorder':
        return this.api.salesorders.delete(r.id)
      case 'salesorderline':
        if (!r.orderId) throw new Error(`salesorderline ${r.id} missing orderId`)
        return this.api.salesorders.deleteLine(r.orderId, r.id)
    }
  }
}
