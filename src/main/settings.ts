import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

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
