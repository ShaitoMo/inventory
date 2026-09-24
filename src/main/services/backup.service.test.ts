import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'
import * as schema from '../db/schema'
import { createTestDb } from '../db/testDb'
import { seedCategory, seedUser } from '../db/testFixtures'
import { createCategory } from '../db/repositories/categories.repository'
import { createItem } from '../db/repositories/items.repository'
import { createMovement } from '../db/repositories/movements.repository'
import { exportBackup, exportSqlBackup } from './backup.service'

describe('exportBackup', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('writes a workbook with one sheet per table, excluding password hashes', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const item = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 5, userId: user.id })

    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-backup-'))
    const { filePath } = await exportBackup(db, tempDir)

    const files = await readdir(tempDir)
    expect(files).toHaveLength(1)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Items',
      'Categories',
      'Movements',
      'Users'
    ])

    function columnIndex(sheet: ExcelJS.Worksheet, header: string): number {
      const headers = sheet.getRow(1).values as string[]
      return headers.indexOf(header)
    }

    const usersSheet = workbook.getWorksheet('Users')!
    const userHeaders = usersSheet.getRow(1).values as string[]
    expect(userHeaders.join(',')).not.toContain('Password')

    const itemsSheet = workbook.getWorksheet('Items')!
    expect(itemsSheet.getRow(2).getCell(columnIndex(itemsSheet, 'Name')).value).toBe('Coffee Beans')
    expect(itemsSheet.getRow(2).getCell(columnIndex(itemsSheet, 'Quantity')).value).toBe(5)

    const movementsSheet = workbook.getWorksheet('Movements')!
    expect(movementsSheet.getRow(2).getCell(columnIndex(movementsSheet, 'Type')).value).toBe('in')
  })

  it('creates the target folder if it does not exist yet', async () => {
    const db = await createTestDb()
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-backup-'))
    const nestedFolder = join(tempDir, 'nested', 'backups')

    const { filePath } = await exportBackup(db, nestedFolder)

    expect(filePath.startsWith(nestedFolder)).toBe(true)
  })
})

describe('exportSqlBackup', () => {
  let tempDir: string

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('writes a data-only, FK-ordered SQL dump that a fresh database can actually replay', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const item = await createItem(db, {
      name: "O'Brien's Mugs",
      categoryId: category.id,
      createdBy: user.id
    })
    await createMovement(db, {
      itemId: item.id,
      type: 'in',
      quantity: 5,
      note: "Restocked - customer's request",
      userId: user.id
    })

    const [{ passwordHash: realHash }] = await db
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))

    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-sql-backup-'))
    const { filePath } = await exportSqlBackup(db, tempDir)
    const sqlText = await readFile(filePath, 'utf-8')

    expect(sqlText).not.toContain(realHash)
    expect(sqlText).toContain("O''Brien''s Mugs")
    expect(sqlText).toContain("Restocked - customer''s request")

    const categoriesIndex = sqlText.indexOf('INSERT INTO "categories"')
    const usersIndex = sqlText.indexOf('INSERT INTO "users"')
    const itemsIndex = sqlText.indexOf('INSERT INTO "items"')
    const movementsIndex = sqlText.indexOf('INSERT INTO "stock_movements"')
    expect(categoriesIndex).toBeGreaterThanOrEqual(0)
    expect(categoriesIndex).toBeLessThan(usersIndex)
    expect(usersIndex).toBeLessThan(itemsIndex)
    expect(itemsIndex).toBeLessThan(movementsIndex)

    const freshDb = await createTestDb()
    await freshDb.$client.exec(sqlText)

    const restoredCategories = await freshDb.select().from(schema.categories)
    const restoredUsers = await freshDb.select().from(schema.users)
    const restoredItems = await freshDb.select().from(schema.items)
    const restoredMovements = await freshDb.select().from(schema.stockMovements)

    expect(restoredCategories).toHaveLength(1)
    expect(restoredItems).toHaveLength(1)
    expect(restoredMovements).toHaveLength(1)
    expect(restoredItems[0].name).toBe("O'Brien's Mugs")
    expect(restoredMovements[0].note).toBe("Restocked - customer's request")
    expect(restoredUsers[0].passwordHash).not.toBe(realHash)

    // The restored sequence must land past the restored id, or a normal
    // app insert right after a restore would collide with it.
    const nextCategory = await createCategory(freshDb, { name: 'Snacks' })
    expect(nextCategory.id).toBeGreaterThan(category.id)
  })

  it('creates the target folder if it does not exist yet', async () => {
    const db = await createTestDb()
    tempDir = await mkdtemp(join(tmpdir(), 'ventrack-sql-backup-'))
    const nestedFolder = join(tempDir, 'nested', 'backups')

    const { filePath } = await exportSqlBackup(db, nestedFolder)

    expect(filePath.startsWith(nestedFolder)).toBe(true)
  })
})
