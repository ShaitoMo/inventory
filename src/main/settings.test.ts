import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  prepareSettingsFilePath,
  readSettings,
  resolveSystemSettingsFilePath,
  writeSettings
} from './settings'

describe('readSettings/writeSettings', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('falls back to the default when no settings file exists yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))

    const settings = await readSettings(join(tempDir, 'settings.json'), 'C:/default')

    expect(settings).toEqual({ backupFolder: 'C:/default' })
  })

  it('round-trips a written value', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'settings.json')

    await writeSettings(filePath, { backupFolder: 'D:/backups' })
    const settings = await readSettings(filePath, 'C:/default')

    expect(settings).toEqual({ backupFolder: 'D:/backups' })
  })

  it('creates missing parent directories when writing', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-settings-'))
    const filePath = join(tempDir, 'nested', 'settings.json')

    await writeSettings(filePath, { backupFolder: 'D:/backups' })

    const settings = await readSettings(filePath, 'C:/default')
    expect(settings).toEqual({ backupFolder: 'D:/backups' })
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
