import { app } from 'electron'
import { cp, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { grantWriteAccessForAllUsers } from '../windowsAcl'
import { joinSystemPath, resolveSystemAppDataRoot } from '../systemPaths'

// Every Windows account on a shared machine needs to see the same inventory
// data, not its own empty copy - `app.getPath('userData')` is scoped to the
// current account, so the live database lives under the per-machine
// ProgramData location (and its macOS/Linux equivalents) instead, the same
// move already made for logs. This assumes one person uses the app at a
// time on a given machine: PGlite is a single-process embedded database,
// not built for two processes writing the same data files concurrently.
export function resolveSystemDataDir(platform: NodeJS.Platform = process.platform): string {
  return joinSystemPath(platform, resolveSystemAppDataRoot(platform), 'pgdata')
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

// One-time upgrade path for a machine that already has data under the old
// per-user location: if the shared directory has never been created yet,
// bring this account's existing database along instead of silently handing
// it an empty one. Copies rather than moves, so the legacy per-user copy is
// left in place untouched as a fallback if anything about this goes wrong -
// it's simply unused once the shared copy exists.
async function migrateLegacyPerUserData(
  systemDataDir: string,
  legacyDataDir: string
): Promise<void> {
  if (await exists(systemDataDir)) return
  if (!(await exists(legacyDataDir))) return

  await mkdir(dirname(systemDataDir), { recursive: true })
  await cp(legacyDataDir, systemDataDir, { recursive: true })
}

export async function prepareDataDir(
  platform: NodeJS.Platform = process.platform,
  // Defaulted rather than hardcoded inside migrateLegacyPerUserData so tests
  // can point this at a throwaway directory instead of this machine's real
  // per-user profile.
  legacyDataDir: string = join(app.getPath('userData'), 'pgdata')
): Promise<string> {
  const dir = resolveSystemDataDir(platform)
  await migrateLegacyPerUserData(dir, legacyDataDir)
  await mkdir(dir, { recursive: true })
  await grantWriteAccessForAllUsers(dir)
  return dir
}
