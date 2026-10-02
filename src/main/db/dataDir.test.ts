import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findOtherAccountsWithLegacyData, prepareDataDir, resolveSystemDataDir } from './dataDir'

describe('resolveSystemDataDir', () => {
  const originalProgramData = process.env.ProgramData

  afterEach(() => {
    if (originalProgramData === undefined) delete process.env.ProgramData
    else process.env.ProgramData = originalProgramData
  })

  it('uses ProgramData on Windows so data is not scoped to one user account', () => {
    process.env.ProgramData = 'C:\\ProgramData'

    expect(resolveSystemDataDir('win32')).toBe('C:\\ProgramData\\ventrack\\pgdata')
  })

  it('uses the standard per-machine app-data directory on macOS and Linux', () => {
    expect(resolveSystemDataDir('darwin')).toBe('/Library/Application Support/ventrack/pgdata')
    expect(resolveSystemDataDir('linux')).toBe('/var/lib/ventrack/pgdata')
  })
})

describe('prepareDataDir', () => {
  let tempDir: string
  const originalProgramData = process.env.ProgramData

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    if (originalProgramData === undefined) delete process.env.ProgramData
    else process.env.ProgramData = originalProgramData
  })

  it('migrates an existing legacy per-user database into the shared location', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-datadir-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const legacyDataDir = join(tempDir, 'legacy-userdata', 'pgdata')
    await mkdir(legacyDataDir, { recursive: true })
    await writeFile(join(legacyDataDir, 'PG_VERSION'), '16')

    const dir = await prepareDataDir('win32', legacyDataDir, join(tempDir, 'Users'))

    expect(dir).toBe(join(tempDir, 'ProgramData', 'ventrack', 'pgdata'))
    expect(await readFile(join(dir, 'PG_VERSION'), 'utf-8')).toBe('16')
    // The legacy copy is left behind untouched, not moved.
    expect(await readFile(join(legacyDataDir, 'PG_VERSION'), 'utf-8')).toBe('16')
  })

  it('does not overwrite an already-created shared database with legacy data', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-datadir-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const sharedDataDir = join(tempDir, 'ProgramData', 'ventrack', 'pgdata')
    await mkdir(sharedDataDir, { recursive: true })
    await writeFile(join(sharedDataDir, 'PG_VERSION'), 'shared')
    const legacyDataDir = join(tempDir, 'legacy-userdata', 'pgdata')
    await mkdir(legacyDataDir, { recursive: true })
    await writeFile(join(legacyDataDir, 'PG_VERSION'), 'legacy')

    await prepareDataDir('win32', legacyDataDir, join(tempDir, 'Users'))

    expect(await readFile(join(sharedDataDir, 'PG_VERSION'), 'utf-8')).toBe('shared')
  })

  it('creates an empty shared directory when neither it nor a legacy copy exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-datadir-'))
    process.env.ProgramData = join(tempDir, 'ProgramData')
    const legacyDataDir = join(tempDir, 'legacy-userdata', 'pgdata')

    const dir = await prepareDataDir('win32', legacyDataDir, join(tempDir, 'Users'))

    expect(dir).toBe(join(tempDir, 'ProgramData', 'ventrack', 'pgdata'))
    await expect(readFile(join(dir, 'PG_VERSION'), 'utf-8')).rejects.toThrow()
  })
})

describe('findOtherAccountsWithLegacyData', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  async function seedProfile(usersRoot: string, name: string, withData: boolean): Promise<string> {
    const dataDir = join(usersRoot, name, 'AppData', 'Roaming', 'ventrack', 'pgdata')
    if (withData) await mkdir(dataDir, { recursive: true })
    else await mkdir(join(usersRoot, name), { recursive: true })
    return dataDir
  }

  it('reports other accounts that have their own ventrack data', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-users-'))
    const current = await seedProfile(tempDir, 'alice', true)
    await seedProfile(tempDir, 'bob', true)
    await seedProfile(tempDir, 'carol', false)

    expect(await findOtherAccountsWithLegacyData(tempDir, current)).toEqual(['bob'])
  })

  it('ignores well-known non-account profile folders', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-users-'))
    const current = await seedProfile(tempDir, 'alice', true)
    await seedProfile(tempDir, 'Public', true)
    await seedProfile(tempDir, 'Default', true)

    expect(await findOtherAccountsWithLegacyData(tempDir, current)).toEqual([])
  })

  it('returns an empty list when the users root cannot be read', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-users-'))

    expect(await findOtherAccountsWithLegacyData(join(tempDir, 'missing'), 'x')).toEqual([])
  })
})
