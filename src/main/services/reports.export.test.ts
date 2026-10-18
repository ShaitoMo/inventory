import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'
import * as schema from '../db/schema'
import { createTestDb } from '../db/testDb'
import { seedCategory, seedUser } from '../db/testFixtures'
import { createItem } from '../db/repositories/items.repository'
import { ValidationError } from './errors'
import { exportMonthlyReport } from './reports.service'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

async function seedItem(
  db: TestDb,
  input: { name: string; categoryId: number; userId: number; quantity: number }
): Promise<number> {
  const item = await createItem(db, {
    name: input.name,
    categoryId: input.categoryId,
    createdBy: input.userId
  })
  await db
    .update(schema.items)
    .set({ quantity: input.quantity, createdAt: new Date(2020, 0, 1) })
    .where(eq(schema.items.id, item.id))
  return item.id
}

describe('exportMonthlyReport', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('writes one sheet per category with item rows and a bold total row', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const beverages = await seedCategory(db, 'Beverages')
    await seedCategory(db, 'Empty')
    const colaId = await seedItem(db, {
      name: 'Cola',
      categoryId: beverages.id,
      userId: user.id,
      quantity: 25
    })
    await seedItem(db, { name: 'Water', categoryId: beverages.id, userId: user.id, quantity: 7 })
    await db.insert(schema.stockMovements).values([
      { itemId: colaId, userId: user.id, type: 'in', quantity: 30, createdAt: new Date(2026, 2, 2) },
      { itemId: colaId, userId: user.id, type: 'out', quantity: 5, createdAt: new Date(2026, 2, 3) }
    ])

    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))
    const { filePath } = await exportMonthlyReport(
      db,
      tempDir,
      { year: 2026, month: 3 },
      new Date(2026, 9, 18, 11, 30, 5)
    )

    expect(basename(filePath)).toBe('ventrack-report-2026-03_2026-10-18_113005.xlsx')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    // "Empty" has no items, so it gets no sheet.
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Beverages'])

    const sheet = workbook.getWorksheet('Beverages')!
    const rows = sheet.getRows(1, sheet.rowCount)!.map((row) => (row.values as unknown[]).slice(1))
    expect(rows).toEqual([
      ['Item', 'Unit', 'Opening', 'In', 'Out', 'Adjust', 'Closing'],
      ['Cola', 'piece', 0, 30, 5, 0, 25],
      ['Water', 'piece', 7, 0, 0, 0, 7],
      ['Total', '', 7, 30, 5, 0, 32]
    ])
    expect(sheet.getRow(4).font?.bold).toBe(true)
    expect(sheet.getRow(2).font?.bold).not.toBe(true)
  })

  it('keeps sheet names valid and unique even when category names are not', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const names = ['Fruit/Veg:?', 'Fruit Veg ', 'x'.repeat(40), 'Back\\slash [1]']
    for (const [index, name] of names.entries()) {
      const category = await seedCategory(db, name)
      await seedItem(db, {
        name: `Item ${index}`,
        categoryId: category.id,
        userId: user.id,
        quantity: 1
      })
    }

    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))
    const { filePath } = await exportMonthlyReport(db, tempDir, { year: 2026, month: 3 })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const sheetNames = workbook.worksheets.map((sheet) => sheet.name)
    expect(sheetNames).toHaveLength(4)
    expect(new Set(sheetNames.map((name) => name.toLowerCase())).size).toBe(4)
    for (const name of sheetNames) {
      expect(name.length).toBeLessThanOrEqual(31)
      // every character Excel forbids in a sheet name, including the backslash
      expect(name).not.toMatch(/[\\/?*[\]:]/)
    }
  })

  it('still writes a valid workbook, creating the folder, when there is nothing to report', async () => {
    const db = await createTestDb()
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))

    const { filePath } = await exportMonthlyReport(db, join(tempDir, 'nested', 'reports'), {
      year: 2026,
      month: 3
    })

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Report'])
  })

  describe('onlyWithMovements', () => {
    // March 2026: Cola moved, Water is idle, and Snacks has nothing but an idle Chips.
    async function seedScenario(db: TestDb): Promise<void> {
      const user = await seedUser(db)
      const beverages = await seedCategory(db, 'Beverages')
      const snacks = await seedCategory(db, 'Snacks')
      const colaId = await seedItem(db, {
        name: 'Cola',
        categoryId: beverages.id,
        userId: user.id,
        quantity: 25
      })
      await seedItem(db, { name: 'Water', categoryId: beverages.id, userId: user.id, quantity: 7 })
      await seedItem(db, { name: 'Chips', categoryId: snacks.id, userId: user.id, quantity: 40 })
      await db.insert(schema.stockMovements).values([
        { itemId: colaId, userId: user.id, type: 'in', quantity: 30, createdAt: new Date(2026, 2, 2) },
        { itemId: colaId, userId: user.id, type: 'out', quantity: 5, createdAt: new Date(2026, 2, 3) }
      ])
    }

    async function readSheets(filePath: string): Promise<Record<string, unknown[][]>> {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(filePath)
      return Object.fromEntries(
        workbook.worksheets.map((sheet) => [
          sheet.name,
          sheet.getRows(1, sheet.rowCount)!.map((row) => (row.values as unknown[]).slice(1))
        ])
      )
    }

    it('leaves idle items and empty categories out of the workbook when asked to', async () => {
      const db = await createTestDb()
      await seedScenario(db)
      tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))

      const { filePath } = await exportMonthlyReport(db, tempDir, {
        year: 2026,
        month: 3,
        onlyWithMovements: true
      })

      expect(await readSheets(filePath)).toEqual({
        Beverages: [
          ['Item', 'Unit', 'Opening', 'In', 'Out', 'Adjust', 'Closing'],
          ['Cola', 'piece', 0, 30, 5, 0, 25],
          ['Total', '', 0, 30, 5, 0, 25]
        ]
      })
    })

    it('exports every item when the flag is absent', async () => {
      const db = await createTestDb()
      await seedScenario(db)
      tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))

      const { filePath } = await exportMonthlyReport(db, tempDir, { year: 2026, month: 3 })

      const sheets = await readSheets(filePath)
      expect(Object.keys(sheets)).toEqual(['Beverages', 'Snacks'])
      expect(sheets.Beverages.map((row) => row[0])).toEqual(['Item', 'Cola', 'Water', 'Total'])
    })

    it('writes the single empty Report sheet when nothing moved in the month', async () => {
      const db = await createTestDb()
      await seedScenario(db)
      tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))

      const { filePath } = await exportMonthlyReport(db, tempDir, {
        year: 2026,
        month: 5,
        onlyWithMovements: true
      })

      expect(await readSheets(filePath)).toEqual({
        Report: [['Item', 'Unit', 'Opening', 'In', 'Out', 'Adjust', 'Closing']]
      })
    })
  })

  it('rejects an invalid month before writing anything', async () => {
    const db = await createTestDb()
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-report-'))

    await expect(exportMonthlyReport(db, tempDir, { year: 2026, month: 13 })).rejects.toThrow(
      ValidationError
    )
  })
})
