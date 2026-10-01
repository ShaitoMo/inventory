import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { appendLog, formatLogEntry, resolveSystemLogDir } from './logger'

describe('formatLogEntry', () => {
  it('includes the level, message, and timestamp with no detail', () => {
    const entry = formatLogEntry('info', 'App started')

    expect(entry).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] \[INFO\] App started\n$/)
  })

  it('inspects detail so stack, cause, and custom error properties survive', () => {
    const cause = new Error('duplicate key value violates unique constraint')
    const error = new Error('Failed query: insert into "items" ...', { cause })
    Object.assign(error, { query: 'insert into "items" ...', params: ['1 bac 6045 Gri', 13] })

    const entry = formatLogEntry('error', 'IPC "items:create" failed', error)

    expect(entry).toContain('Failed query: insert into "items"')
    expect(entry).toContain('duplicate key value violates unique constraint')
    expect(entry).toContain("params: [ '1 bac 6045 Gri', 13 ]")
  })
})

describe('resolveSystemLogDir', () => {
  const originalProgramData = process.env.ProgramData

  afterEach(() => {
    if (originalProgramData === undefined) delete process.env.ProgramData
    else process.env.ProgramData = originalProgramData
  })

  it('uses ProgramData on Windows so logs are not scoped to one user account', () => {
    process.env.ProgramData = 'C:\\ProgramData'

    expect(resolveSystemLogDir('win32')).toBe('C:\\ProgramData\\ventrack\\logs')
  })

  it('falls back to a fixed path if ProgramData is unset', () => {
    delete process.env.ProgramData

    expect(resolveSystemLogDir('win32')).toBe('C:\\ProgramData\\ventrack\\logs')
  })

  it('uses the standard system log directory on macOS and Linux', () => {
    expect(resolveSystemLogDir('darwin')).toBe('/Library/Logs/ventrack')
    expect(resolveSystemLogDir('linux')).toBe('/var/log/ventrack')
  })
})

describe('appendLog', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('creates missing parent directories and appends entries', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-logger-'))
    const filePath = join(tempDir, 'logs', 'main.log')

    await appendLog(filePath, 'info', 'first')
    await appendLog(filePath, 'error', 'second', new Error('boom'))

    const contents = await readFile(filePath, 'utf-8')
    expect(contents).toContain('[INFO] first')
    expect(contents).toContain('[ERROR] second')
    expect(contents).toContain('Error: boom')
  })

  it('rotates the file to .1 once it crosses the byte limit', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-logger-'))
    const filePath = join(tempDir, 'main.log')

    await appendLog(filePath, 'info', 'a'.repeat(50), undefined, 100)
    await appendLog(filePath, 'info', 'b'.repeat(50), undefined, 100)

    const rotated = await readFile(`${filePath}.1`, 'utf-8')
    const current = await readFile(filePath, 'utf-8')
    expect(rotated).toContain('a'.repeat(50))
    expect(current).toContain('b'.repeat(50))
    expect(current).not.toContain('a'.repeat(50))
  })
})
