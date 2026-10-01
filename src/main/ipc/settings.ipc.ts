import { dialog } from 'electron'
import { join } from 'node:path'
import { Db } from '../db/types'
import { prepareSettingsFilePath, readSettings, writeSettings, type AppSettings } from '../settings'
import { resolveSystemAppDataRoot } from '../systemPaths'
import { exportBackup, exportSqlBackup } from '../services/backup.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

// Shared across every Windows account on the machine, same as the backup
// folder preference itself (see settings.ts) - Public\Documents is the
// standard discoverable "everyone can find this" location on Windows,
// unlike the current user's own Documents folder.
function defaultBackupFolder(platform: NodeJS.Platform = process.platform): string {
  switch (platform) {
    case 'win32':
      return join(process.env.Public ?? 'C:\\Users\\Public', 'Documents', 'Ventrack Backups')
    case 'darwin':
      return '/Users/Shared/Ventrack Backups'
    default:
      return join(resolveSystemAppDataRoot(platform), 'backups')
  }
}

async function loadSettings(): Promise<AppSettings> {
  return readSettings(await prepareSettingsFilePath(), defaultBackupFolder())
}

export function registerSettingsIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.settings.get, () => loadSettings())

  protectedHandle(IPC_CHANNELS.settings.chooseFolder, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  protectedHandle(IPC_CHANNELS.settings.updateBackupFolder, async (_user, backupFolder: string) => {
    const settings: AppSettings = { backupFolder }
    await writeSettings(await prepareSettingsFilePath(), settings)
    return settings
  })

  protectedHandle(IPC_CHANNELS.backup.export, async () => {
    const settings = await loadSettings()
    return exportBackup(db, settings.backupFolder)
  })

  protectedHandle(IPC_CHANNELS.backup.exportSql, async () => {
    const settings = await loadSettings()
    return exportSqlBackup(db, settings.backupFolder)
  })
}
