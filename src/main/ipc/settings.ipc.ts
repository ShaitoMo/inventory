import { app, dialog } from 'electron'
import { join } from 'node:path'
import { Db } from '../db/types'
import { readSettings, writeSettings, type AppSettings } from '../settings'
import { exportBackup, exportSqlBackup } from '../services/backup.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function defaultBackupFolder(): string {
  return join(app.getPath('documents'), 'Ventrack Backups')
}

async function loadSettings(): Promise<AppSettings> {
  return readSettings(settingsFilePath(), defaultBackupFolder())
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
    await writeSettings(settingsFilePath(), settings)
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
