import { dialog } from 'electron'
import { join } from 'node:path'
import { Db } from '../db/types'
import { prepareSettingsFilePath, readSettings, updateSettings, type AppSettings } from '../settings'
import { resolveSystemAppDataRoot } from '../systemPaths'
import { exportBackup, exportSqlBackup } from '../services/backup.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

// Shared across every Windows account on the machine, same as the folder
// preferences themselves (see settings.ts) - Public\Documents is the
// standard discoverable "everyone can find this" location on Windows,
// unlike the current user's own Documents folder. Each feature gets its own
// folder under it (or its own subfolder of the app-data root elsewhere).
function defaultFolder(
  names: { shared: string; subfolder: string },
  platform: NodeJS.Platform = process.platform
): string {
  switch (platform) {
    case 'win32':
      return join(process.env.Public ?? 'C:\\Users\\Public', 'Documents', names.shared)
    case 'darwin':
      return `/Users/Shared/${names.shared}`
    default:
      return join(resolveSystemAppDataRoot(platform), names.subfolder)
  }
}

function defaultSettings(): AppSettings {
  return {
    backupFolder: defaultFolder({ shared: 'Ventrack Backups', subfolder: 'backups' }),
    reportsFolder: defaultFolder({ shared: 'Ventrack Reports', subfolder: 'reports' })
  }
}

export async function loadSettings(): Promise<AppSettings> {
  return readSettings(await prepareSettingsFilePath(), defaultSettings())
}

export function registerSettingsIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.settings.get, () => loadSettings())

  protectedHandle(IPC_CHANNELS.settings.chooseFolder, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  protectedHandle(IPC_CHANNELS.settings.updateBackupFolder, async (_user, backupFolder: string) =>
    updateSettings(await prepareSettingsFilePath(), defaultSettings(), { backupFolder })
  )

  protectedHandle(IPC_CHANNELS.settings.updateReportsFolder, async (_user, reportsFolder: string) =>
    updateSettings(await prepareSettingsFilePath(), defaultSettings(), { reportsFolder })
  )

  protectedHandle(IPC_CHANNELS.backup.export, async () => {
    const settings = await loadSettings()
    return exportBackup(db, settings.backupFolder)
  })

  protectedHandle(IPC_CHANNELS.backup.exportSql, async () => {
    const settings = await loadSettings()
    return exportSqlBackup(db, settings.backupFolder)
  })
}
