import { app } from 'electron'
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { joinSystemPath, resolveSystemAppDataRoot } from './systemPaths'

export interface AppSettings {
  backupFolder: string
}

export async function readSettings(
  filePath: string,
  defaultBackupFolder: string
): Promise<AppSettings> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { backupFolder: parsed.backupFolder ?? defaultBackupFolder }
  } catch {
    return { backupFolder: defaultBackupFolder }
  }
}

export async function writeSettings(filePath: string, settings: AppSettings): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(settings, null, 2))
}

// Settings (currently just the chosen backup folder) live alongside the
// database under the shared, per-machine location - like the database, this
// was previously scoped to `app.getPath('userData')`, so whichever Windows
// account configured a backup folder was the only one the app would ever
// use it for.
export function resolveSystemSettingsFilePath(
  platform: NodeJS.Platform = process.platform
): string {
  return joinSystemPath(platform, resolveSystemAppDataRoot(platform), 'settings.json')
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

// One-time upgrade path, mirroring db/dataDir.ts: if this account already
// had a backup folder configured under the old per-user settings file,
// bring it along instead of silently resetting to the default the first
// time the app runs after settings became shared.
async function migrateLegacySettingsFile(
  systemFilePath: string,
  legacyFilePath: string
): Promise<void> {
  if (await exists(systemFilePath)) return
  if (!(await exists(legacyFilePath))) return

  await mkdir(dirname(systemFilePath), { recursive: true })
  await cp(legacyFilePath, systemFilePath)
}

export async function prepareSettingsFilePath(
  platform: NodeJS.Platform = process.platform,
  // Defaulted rather than hardcoded inside migrateLegacySettingsFile so
  // tests can point this at a throwaway file instead of this machine's
  // real per-user profile.
  legacyFilePath: string = join(app.getPath('userData'), 'settings.json')
): Promise<string> {
  const filePath = resolveSystemSettingsFilePath(platform)
  await migrateLegacySettingsFile(filePath, legacyFilePath)
  return filePath
}
