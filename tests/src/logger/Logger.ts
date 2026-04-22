const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function stamp(): string {
  const d = new Date()
  return (
    d.toTimeString().slice(0, 8) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

export class Logger {
  private readonly minLevel: number

  constructor(
    private readonly scope: string,
    level: LogLevel = (process.env.HECRM_LOG_LEVEL as LogLevel | undefined) ?? 'info',
  ) {
    this.minLevel = LEVEL_ORDER[level]
  }

  child(subScope: string): Logger {
    return new Logger(`${this.scope} ▸ ${subScope}`)
  }

  debug(msg: string, meta?: unknown): void {
    this.emit('debug', ANSI.gray, msg, meta)
  }

  info(msg: string, meta?: unknown): void {
    this.emit('info', ANSI.cyan, msg, meta)
  }

  warn(msg: string, meta?: unknown): void {
    this.emit('warn', ANSI.yellow, msg, meta)
  }

  error(msg: string, meta?: unknown): void {
    this.emit('error', ANSI.red, msg, meta)
  }

  step(name: string): void {
    if (this.minLevel > LEVEL_ORDER.info) return
    const header = `${ANSI.bold}${ANSI.blue}▶ ${name}${ANSI.reset}`
    console.log(`${ANSI.gray}${stamp()}${ANSI.reset} ${ANSI.magenta}[${this.scope}]${ANSI.reset} ${header}`)
  }

  request(method: string, url: string, status?: number, durationMs?: number): void {
    if (this.minLevel > LEVEL_ORDER.info) return
    const statusColor =
      status === undefined
        ? ANSI.gray
        : status < 300
          ? ANSI.green
          : status < 400
            ? ANSI.cyan
            : status < 500
              ? ANSI.yellow
              : ANSI.red
    const statusStr = status === undefined ? '---' : String(status)
    const duration = durationMs !== undefined ? `${ANSI.gray}(${durationMs.toFixed(0)}ms)${ANSI.reset}` : ''
    console.log(
      `${ANSI.gray}${stamp()}${ANSI.reset} ${ANSI.magenta}[${this.scope}]${ANSI.reset} ` +
        `${ANSI.dim}http${ANSI.reset} ${method.padEnd(6)} ${statusColor}${statusStr}${ANSI.reset} ${url} ${duration}`,
    )
  }

  private emit(level: LogLevel, color: string, msg: string, meta?: unknown): void {
    if (this.minLevel > LEVEL_ORDER[level]) return
    const prefix = `${ANSI.gray}${stamp()}${ANSI.reset} ${ANSI.magenta}[${this.scope}]${ANSI.reset}`
    const badge = `${color}${level.toUpperCase().padEnd(5)}${ANSI.reset}`
    const metaStr = meta !== undefined ? ` ${ANSI.dim}${safeJson(meta)}${ANSI.reset}` : ''
    console.log(`${prefix} ${badge} ${msg}${metaStr}`)
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
