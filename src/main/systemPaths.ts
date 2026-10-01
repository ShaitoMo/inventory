import { win32 } from 'node:path'

// The per-machine (not per-user) root this app keeps shared state under.
// Used by both the database directory and app settings - "persistent app
// state" belongs in the same place under each OS's convention. Logs are
// deliberately not resolved from here: Windows treats them the same as any
// other per-machine state (ProgramData), but macOS and Linux file logs
// under a distinct path from app data, so logger.ts keeps its own resolver.
export function resolveSystemAppDataRoot(platform: NodeJS.Platform = process.platform): string {
  switch (platform) {
    case 'win32':
      return win32.join(process.env.ProgramData ?? 'C:\\ProgramData', 'ventrack')
    case 'darwin':
      return '/Library/Application Support/ventrack'
    default:
      return '/var/lib/ventrack'
  }
}

// `node:path`'s plain `join` always uses the *running* OS's separator,
// which is wrong when building a path for a platform other than the one
// actually executing (e.g. resolving a macOS path for a test, or in a
// cross-compiled build) - this resolves a path for the given platform
// explicitly instead.
export function joinSystemPath(platform: NodeJS.Platform, ...segments: string[]): string {
  return platform === 'win32' ? win32.join(...segments) : segments.join('/')
}
