import { app } from 'electron'
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { grantWriteAccessForAllUsers } from '../windowsAcl'
import { joinSystemPath, resolveSystemAppDataRoot } from '../systemPaths'
import { logWarn } from '../logger'

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

// Profile-root entries that are never a real account, so never worth
// reporting even if one happens to have a stray ventrack folder under it.
const IGNORED_PROFILE_NAMES = new Set([
  'Public',
  'Default',
  'Default User',
  'All Users',
  'defaultuser0'
])

// Auto-migration only ever looks at *this* Windows account's legacy data -
// if the real business data actually belongs to a different account (e.g.
// the update was first launched under the wrong login), it would be
// silently left behind with no error, which is exactly the kind of
// surprise that prompted this check. Best-effort and read-only: listing
// `usersRoot` itself is normally allowed for any account, but Windows'
// default per-profile ACLs mean reading *into* another account's AppData
// will usually fail with EPERM - that's treated as "can't tell", not as
// "nothing there", so this can under-report but should never false-alarm.
export async function findOtherAccountsWithLegacyData(
  usersRoot: string,
  currentLegacyDataDir: string
): Promise<string[]> {
  let entries: string[]
  try {
    entries = await readdir(usersRoot)
  } catch {
    return []
  }

  const found: string[] = []
  for (const entry of entries) {
    if (IGNORED_PROFILE_NAMES.has(entry)) continue
    const candidateDataDir = join(usersRoot, entry, 'AppData', 'Roaming', 'ventrack', 'pgdata')
    if (candidateDataDir === currentLegacyDataDir) continue
    if (await exists(candidateDataDir)) found.push(entry)
  }
  return found
}

export async function prepareDataDir(
  platform: NodeJS.Platform = process.platform,
  // Defaulted rather than hardcoded inside migrateLegacyPerUserData so tests
  // can point this at a throwaway directory instead of this machine's real
  // per-user profile.
  legacyDataDir: string = join(app.getPath('userData'), 'pgdata'),
  usersRoot: string = dirname(app.getPath('home'))
): Promise<string> {
  const dir = resolveSystemDataDir(platform)
  await migrateLegacyPerUserData(dir, legacyDataDir)
  await mkdir(dir, { recursive: true })
  await grantWriteAccessForAllUsers(dir)

  if (platform === 'win32') {
    const otherAccounts = await findOtherAccountsWithLegacyData(usersRoot, legacyDataDir)
    if (otherAccounts.length > 0) {
      await logWarn(
        'Other Windows accounts on this machine have their own ventrack data that was not ' +
          'migrated into the shared database - review manually so nothing is missed',
        { accounts: otherAccounts, usersRoot }
      )
    }
  }

  return dir
}
