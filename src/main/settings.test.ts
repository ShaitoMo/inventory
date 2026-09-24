import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readSettings, writeSettings } from './settings'

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
