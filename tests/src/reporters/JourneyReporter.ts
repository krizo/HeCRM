import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter'
import fs from 'node:fs'
import path from 'node:path'

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
}

interface StepRecord {
  title: string
  duration: number
  error?: string
  depth: number
}

interface TestRecord {
  title: string
  file: string
  journey: string
  status: TestResult['status']
  duration: number
  steps: StepRecord[]
  error?: string
}

/**
 * Custom reporter that groups tests by "journey" (test-file basename),
 * surfaces step-level timings, and writes a markdown summary to
 * `test-results/summary.md` for CI artifacts / PR comments.
 */
export default class JourneyReporter implements Reporter {
  private readonly records: TestRecord[] = []
  private readonly stepStack = new WeakMap<TestCase, StepRecord[]>()
  private config!: FullConfig

  onBegin(config: FullConfig): void {
    this.config = config
    const projects = config.projects.map((p) => p.name).join(', ')
    line(`${C.bold}${C.cyan}━━━ HeCRM test run ━━━${C.reset}`)
    line(`${C.dim}projects:${C.reset} ${projects}`)
    line(`${C.dim}workers:${C.reset}  ${config.workers}`)
    line('')
  }

  onTestBegin(test: TestCase): void {
    this.stepStack.set(test, [])
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return
    const stack = this.stepStack.get(test) ?? []
    stack.push({
      title: step.title,
      duration: 0,
      depth: countDepth(step),
    })
    this.stepStack.set(test, stack)
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return
    const stack = this.stepStack.get(test)
    if (!stack) return
    const record = stack.reverse().find((s) => s.title === step.title && s.duration === 0)
    stack.reverse()
    if (record) {
      record.duration = step.duration
      if (step.error) record.error = step.error.message
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const journey = journeyName(test)
    const steps = this.stepStack.get(test) ?? []
    const record: TestRecord = {
      title: test.title,
      file: test.location.file,
      journey,
      status: result.status,
      duration: result.duration,
      steps,
      error: result.error?.message,
    }
    this.records.push(record)
    this.printTest(record)
  }

  onEnd(result: FullResult): void | Promise<void> {
    line('')
    line(`${C.bold}${C.cyan}━━━ Summary ━━━${C.reset}`)
    const byJourney = groupBy(this.records, (r) => r.journey)
    const totals = { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0, flaky: 0 }

    for (const [journey, tests] of byJourney) {
      const pass = tests.filter((t) => t.status === 'passed').length
      const fail = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length
      const dur = tests.reduce((s, t) => s + t.duration, 0)
      const ok = fail === 0
      const badge = ok
        ? `${C.bgGreen}${C.bold} PASS ${C.reset}`
        : `${C.bgRed}${C.bold} FAIL ${C.reset}`
      line(
        `${badge} ${C.bold}${journey.padEnd(28)}${C.reset} ` +
          `${C.green}${pass} passed${C.reset}${fail ? `  ${C.red}${fail} failed${C.reset}` : ''}  ${C.gray}(${dur}ms)${C.reset}`,
      )
      for (const t of tests) {
        totals[t.status] = (totals[t.status] ?? 0) + 1
        const mark =
          t.status === 'passed'
            ? `${C.green}✓${C.reset}`
            : t.status === 'failed' || t.status === 'timedOut'
              ? `${C.red}✗${C.reset}`
              : `${C.yellow}○${C.reset}`
        line(`   ${mark} ${t.title} ${C.gray}(${t.duration}ms)${C.reset}`)
      }
    }

    line('')
    const total = this.records.length
    line(
      `${C.bold}Total:${C.reset} ${total}    ` +
        `${C.green}passed: ${totals.passed}${C.reset}    ` +
        `${C.red}failed: ${totals.failed}${C.reset}    ` +
        `${C.yellow}skipped: ${totals.skipped}${C.reset}    ` +
        `duration: ${result.duration}ms`,
    )

    const slow = [...this.records].sort((a, b) => b.duration - a.duration).slice(0, 5)
    if (slow.length > 0) {
      line('')
      line(`${C.bold}Slowest tests:${C.reset}`)
      for (const t of slow) {
        line(`   ${C.gray}${t.duration.toString().padStart(6)}ms${C.reset}  ${t.title}`)
      }
    }

    this.writeMarkdownSummary(result)
  }

  private printTest(r: TestRecord): void {
    const mark =
      r.status === 'passed'
        ? `${C.green}✓${C.reset}`
        : r.status === 'failed' || r.status === 'timedOut'
          ? `${C.red}✗${C.reset}`
          : `${C.yellow}○${C.reset}`
    line(`${mark} ${C.bold}${r.title}${C.reset} ${C.gray}— ${r.journey} (${r.duration}ms)${C.reset}`)
    for (const step of r.steps) {
      const indent = '    '.repeat(Math.min(step.depth, 4))
      const statusDot = step.error ? `${C.red}●${C.reset}` : `${C.gray}·${C.reset}`
      line(
        `  ${indent}${statusDot} ${step.title} ${C.gray}(${step.duration}ms)${C.reset}` +
          (step.error ? `\n      ${C.red}${step.error.split('\n')[0]}${C.reset}` : ''),
      )
    }
    if (r.error) {
      line(`  ${C.red}→ ${r.error.split('\n')[0]}${C.reset}`)
    }
  }

  private writeMarkdownSummary(result: FullResult): void {
    const outDir = path.resolve(
      path.dirname(this.config.configFile ?? '.'),
      'test-results',
    )
    fs.mkdirSync(outDir, { recursive: true })
    const file = path.join(outDir, 'summary.md')

    const rows = [...groupBy(this.records, (r) => r.journey).entries()]
      .map(([journey, tests]) => {
        const pass = tests.filter((t) => t.status === 'passed').length
        const fail = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut').length
        const dur = tests.reduce((s, t) => s + t.duration, 0)
        const icon = fail === 0 ? '✅' : '❌'
        return `| ${icon} ${journey} | ${tests.length} | ${pass} | ${fail} | ${dur}ms |`
      })
      .join('\n')

    const failedDetails = this.records
      .filter((r) => r.status === 'failed' || r.status === 'timedOut')
      .map((r) => `- **${r.title}** (${r.journey})\n  \`\`\`\n  ${r.error ?? 'no error message captured'}\n  \`\`\``)
      .join('\n')

    const body = `# HeCRM test run — ${result.status}

Total duration: **${result.duration}ms**

| Journey | Total | Passed | Failed | Duration |
|---------|-------|--------|--------|----------|
${rows}

${failedDetails ? `## Failures\n\n${failedDetails}\n` : '✅ All tests passed.\n'}
`

    fs.writeFileSync(file, body, 'utf-8')
    line('')
    line(`${C.dim}Markdown summary written to ${path.relative(process.cwd(), file)}${C.reset}`)
  }
}

function journeyName(test: TestCase): string {
  const base = path.basename(test.location.file)
  return base.replace(/\.api\.spec\.ts$|\.ui\.spec\.ts$|\.spec\.ts$/, '')
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k) ?? []
    list.push(item)
    map.set(k, list)
  }
  return map
}

function countDepth(step: TestStep): number {
  let depth = 0
  let current: TestStep | undefined = step.parent
  while (current) {
    if (current.category === 'test.step') depth += 1
    current = current.parent
  }
  return depth
}

function line(msg: string): void {
  console.log(msg)
}
