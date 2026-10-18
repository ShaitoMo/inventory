import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  prepareSettingsFilePath,
  readSettings,
  resolveSystemSettingsFilePath,
  updateSettings,
  writeSettings
} from './settings'

const DEFAULTS = { backupFolder: 'C:/default-backups', reportsFolder: 'C:/default-reports' }

describe('readSettings/writeSettings', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('falls back to the defaults when no settings file exists yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))

    const settings = await readSettings(join(tempDir, 'settings.json'), DEFAULTS)

    expect(settings).toEqual(DEFAULTS)
  })

  it('round-trips written values', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')

    await writeSettings(filePath, { backupFolder: 'D:/backups', reportsFolder: 'D:/reports' })
    const settings = await readSettings(filePath, DEFAULTS)

    expect(settings).toEqual({ backupFolder: 'D:/backups', reportsFolder: 'D:/reports' })
  })

  it('keeps a saved backup folder and defaults the reports folder for a file written before it existed', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')
    await writeFile(filePath, JSON.stringify({ backupFolder: 'D:/old-backups' }))

    const settings = await readSettings(filePath, DEFAULTS)

    expect(settings).toEqual({
      backupFolder: 'D:/old-backups',
      reportsFolder: 'C:/default-reports'
    })
  })

  it('falls back to the defaults when the file is not valid JSON', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')
    await writeFile(filePath, '{ not json')

    expect(await readSettings(filePath, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('creates missing parent directories when writing', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'nested', 'settings.json')

    await writeSettings(filePath, { backupFolder: 'D:/backups', reportsFolder: 'D:/reports' })

    const settings = await readSettings(filePath, DEFAULTS)
    expect(settings).toEqual({ backupFolder: 'D:/backups', reportsFolder: 'D:/reports' })
  })
})

describe('updateSettings', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('changes one folder without losing the other', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')
    await writeSettings(filePath, { backupFolder: 'D:/backups', reportsFolder: 'D:/reports' })

    const afterBackup = await updateSettings(filePath, DEFAULTS, { backupFolder: 'E:/backups' })
    const afterReports = await updateSettings(filePath, DEFAULTS, { reportsFolder: 'E:/reports' })

    expect(afterBackup).toEqual({ backupFolder: 'E:/backups', reportsFolder: 'D:/reports' })
    expect(afterReports).toEqual({ backupFolder: 'E:/backups', reportsFolder: 'E:/reports' })
    expect(await readSettings(filePath, DEFAULTS)).toEqual(afterReports)
  })

  it('writes the defaults for everything else when there is no file yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')

    const settings = await updateSettings(filePath, DEFAULTS, { reportsFolder: 'D:/reports' })

    expect(settings).toEqual({ backupFolder: 'C:/default-backups', reportsFolder: 'D:/reports' })
    expect(JSON.parse(await readFile(filePath, 'utf-8'))).toEqual(settings)
  })
})

describe('resolveSystemSettingsFilePath', () => {
  const originalProgramData = process.env.ProgramData

  afterEach(() => {
    if (originalProgramData === undefined) delete process.env.ProgramData
    else process.env.ProgramData = originalProgramData
  })

  it('uses ProgramData on Windows so settings are not scoped to one user account', () => {
    process.env.ProgramData = 'C:\\ProgramData'

    expect(resolveSystemSettingsFilePath('win32')).toBe('C:\\ProgramData\\ventrack\\settings.json')
  })

  it('uses the standard per-machine app-data directory on macOS and Linux', () => {
    expect(resolveSystemSettingsFilePath('darwin')).toBe(
      '/Library/Application Support/ventrack/settings.json'
    )
    expect(resolveSystemSettingsFilePath('linux')).toBe('/var/lib/ventrack/settings.json')
  })
})

describe('prepareSettingsFilePath', () => {
  let tempDir: string
  const originalProgramData = process.env.ProgramData

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    if (originalProgramData === undefined) delete process.env.ProgramData
    else process.env.ProgramData = originalProgramData
  })

  it('migrates an existing legacy per-user settings file into the shared location', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-sys-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const legacyFilePath = join(tempDir, 'legacy-userdata', 'settings.json')
    await mkdir(join(tempDir, 'legacy-userdata'), { recursive: true })
    await writeFile(legacyFilePath, JSON.stringify({ backupFolder: 'D:/legacy-backups' }))

    const filePath = await prepareSettingsFilePath('win32', legacyFilePath)

    expect(filePath).toBe(join(tempDir, 'ProgramData', 'ventrack', 'settings.json'))
    const migrated = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(migrated).toEqual({ backupFolder: 'D:/legacy-backups' })
  })

  it('does not overwrite an already-created shared settings file with legacy data', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-sys-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const sharedFilePath = join(tempDir, 'ProgramData', 'ventrack', 'settings.json')
    await mkdir(join(tempDir, 'ProgramData', 'ventrack'), { recursive: true })
    await writeFile(sharedFilePath, JSON.stringify({ backupFolder: 'D:/shared-backups' }))
    const legacyFilePath = join(tempDir, 'legacy-userdata', 'settings.json')
    await mkdir(join(tempDir, 'legacy-userdata'), { recursive: true })
    await writeFile(legacyFilePath, JSON.stringify({ backupFolder: 'D:/legacy-backups' }))

    await prepareSettingsFilePath('win32', legacyFilePath)

    const settings = JSON.parse(await readFile(sharedFilePath, 'utf-8'))
    expect(settings).toEqual({ backupFolder: 'D:/shared-backups' })
  })

  it('returns the shared path even when neither it nor a legacy file exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-sys-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const legacyFilePath = join(tempDir, 'legacy-userdata', 'settings.json')

    const filePath = await prepareSettingsFilePath('win32', legacyFilePath)

    expect(filePath).toBe(join(tempDir, 'ProgramData', 'ventrack', 'settings.json'))
  })
})
