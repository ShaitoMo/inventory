import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { inspect } from 'node:util'
import { grantWriteAccessForAllUsers } from './windowsAcl'

export type LogLevel = 'info' | 'warn' | 'error'

// A single file left to grow across months of daily use would eventually
// become unreadable (and un-openable) - once it crosses this size the
// previous contents are kept as one `.1` backup and a fresh file is
// started, rather than pulling in a rotation library for one desktop log.
const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024

// `detail` is typically the caught `Error` itself. `inspect` (not
// `JSON.stringify`) is what picks up `.stack`, the `.cause` chain, and any
// extra own properties a custom error sets (e.g. drizzle's
// `DrizzleQueryError` carries `.query`/`.params`) - all of which
// `error.message` alone drops.
export function formatLogEntry(level: LogLevel, message: string, detail?: unknown): string {
  const timestamp = new Date().toISOString()
  const header = `[${timestamp}] [${level.toUpperCase()}] ${message}`
  if (detail === undefined) return `${header}\n`
  return `${header}\n${inspect(detail, { depth: 10 })}\n\n`
}

export async function appendLog(
  filePath: string,
  level: LogLevel,
  message: string,
  detail?: unknown,
  maxBytes: number = DEFAULT_MAX_LOG_BYTES
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })

  const entry = formatLogEntry(level, message, detail)
  const currentSize = await stat(filePath)
    .then((s) => s.size)
    .catch(() => 0)
  // Rotate before writing, not after, so the file never grows past
  // `maxBytes` in the first place - checking after the fact would let it
  // overshoot by up to one entry every rotation.
  if (currentSize > 0 && currentSize + Buffer.byteLength(entry) > maxBytes) {
    await rename(filePath, `${filePath}.1`)
  }

  await appendFile(filePath, entry)
}

// Every account on the machine shares one install, and logs need to stay
// readable/writable no matter who's signed in when the app runs - not just
// whoever happened to launch it first. ProgramData (and its macOS/Linux
// analogues) is the standard per-machine, not per-user, location, unlike
// `app.getPath('userData')` which is scoped to the current Windows account.
export function resolveSystemLogDir(platform: NodeJS.Platform = process.platform): string {
  switch (platform) {
    case 'win32':
      return join(process.env.ProgramData ?? 'C:\\ProgramData', 'ventrack', 'logs')
    case 'darwin':
      return '/Library/Logs/ventrack'
    default:
      return '/var/log/ventrack'
  }
}

export async function prepareLogDirectory(
  platform: NodeJS.Platform = process.platform
): Promise<string> {
  const dir = resolveSystemLogDir(platform)
  await mkdir(dir, { recursive: true })
  await grantWriteAccessForAllUsers(dir)
  return join(dir, 'main.log')
}

// The rest of the main process logs through a single active file set once
// at startup (see `initLogger` in index.ts), the same lazy-singleton
// shape `db/client.ts` uses for the PGlite connection - callers elsewhere
// just call `logError`/`logWarn`/`logInfo` without threading a path
// through every function.
let activeLogFilePath: string | null = null

export function initLogger(filePath: string): void {
  activeLogFilePath = filePath
}

function write(level: LogLevel, message: string, detail?: unknown): Promise<void> {
  const consoleMethod =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  consoleMethod(message, detail ?? '')

  if (!activeLogFilePath) return Promise.resolve()
  return appendLog(activeLogFilePath, level, message, detail).catch((writeError) => {
    console.error('Failed to write log file', writeError)
  })
}

export function logInfo(message: string, detail?: unknown): Promise<void> {
  return write('info', message, detail)
}

export function logWarn(message: string, detail?: unknown): Promise<void> {
  return write('warn', message, detail)
}

export function logError(message: string, detail?: unknown): Promise<void> {
  return write('error', message, detail)
}
