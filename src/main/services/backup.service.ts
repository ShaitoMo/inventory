import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { Db } from '../db/types'
import * as schema from '../db/schema'
import { listCategories } from '../db/repositories/categories.repository'
import { hashPassword, listUsers } from '../db/repositories/users.repository'
import { toServiceError } from './errors'

const ITEM_COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Name', key: 'name' },
  { header: 'Category ID', key: 'categoryId' },
  { header: 'Unit', key: 'unit' },
  { header: 'Quantity', key: 'quantity' },
  { header: 'Min Qty', key: 'minQty' },
  { header: 'Created By', key: 'createdBy' },
  { header: 'Created At', key: 'createdAt' },
  { header: 'Updated At', key: 'updatedAt' }
]

const CATEGORY_COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Name', key: 'name' }
]

const MOVEMENT_COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Item ID', key: 'itemId' },
  { header: 'Type', key: 'type' },
  { header: 'Quantity', key: 'quantity' },
  { header: 'Note', key: 'note' },
  { header: 'User ID', key: 'userId' },
  { header: 'Created At', key: 'createdAt' }
]

// Never a passwordHash column here - a backup is something a user could hand
// off or store outside the app, not a place password hashes should end up.
const USER_COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Username', key: 'username' },
  { header: 'Created At', key: 'createdAt' }
]

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function backupTimestamp(now: Date): string {
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

function backupFileName(now = new Date()): string {
  return `ventrack-backup-${backupTimestamp(now)}.xlsx`
}

function sqlBackupFileName(now = new Date()): string {
  return `ventrack-backup-${backupTimestamp(now)}.sql`
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: { header: string; key: string }[],
  rows: Record<string, unknown>[]
): void {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = columns
  sheet.addRows(rows)
}

export async function exportBackup(db: Db, folder: string): Promise<{ filePath: string }> {
  try {
    const [items, categories, movements, users] = await Promise.all([
      db.select().from(schema.items).orderBy(schema.items.id),
      listCategories(db),
      db.select().from(schema.stockMovements).orderBy(schema.stockMovements.id),
      listUsers(db)
    ])

    const workbook = new ExcelJS.Workbook()
    addSheet(workbook, 'Items', ITEM_COLUMNS, items)
    addSheet(workbook, 'Categories', CATEGORY_COLUMNS, categories)
    addSheet(workbook, 'Movements', MOVEMENT_COLUMNS, movements)
    addSheet(workbook, 'Users', USER_COLUMNS, users)

    await mkdir(folder, { recursive: true })
    const filePath = join(folder, backupFileName())
    await workbook.xlsx.writeFile(filePath)

    return { filePath }
  } catch (error) {
    throw toServiceError(error)
  }
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return `'${value.toISOString()}'`
  return `'${String(value).replace(/'/g, "''")}'`
}

function insertStatements(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  if (rows.length === 0) return `-- ${table}: no rows\n`

  const columnList = columns.map((column) => `"${column}"`).join(', ')
  const valueRows = rows.map(
    (row) => `  (${columns.map((column) => sqlLiteral(row[column])).join(', ')})`
  )
  return `INSERT INTO "${table}" (${columnList}) VALUES\n${valueRows.join(',\n')};\n`
}

// `serial` primary keys leave a `<table>_id_seq` sequence behind at the
// default Postgres name - restoring rows with explicit ids (rather than
// letting the sequence assign them) leaves that sequence unaware of the
// ids it now needs to skip past, so the next real insert would collide.
function sequenceResetStatement(table: string, rows: { id: number }[]): string {
  const maxId = rows.reduce((max, row) => Math.max(max, row.id), 0)
  return `SELECT setval('${table}_id_seq', ${maxId > 0 ? maxId : 1}, ${maxId > 0});\n`
}

export async function exportSqlBackup(db: Db, folder: string): Promise<{ filePath: string }> {
  try {
    const [items, categories, movements, users] = await Promise.all([
      db.select().from(schema.items).orderBy(schema.items.id),
      listCategories(db),
      db.select().from(schema.stockMovements).orderBy(schema.stockMovements.id),
      listUsers(db)
    ])

    // `password_hash` is NOT NULL and never leaves the app - a restored
    // account gets one shared, unguessable placeholder hash instead of the
    // real one, so a restore satisfies the column without leaking anything;
    // the account needs its password reset before it can sign in again.
    const placeholderPasswordHash = await hashPassword(randomBytes(24).toString('hex'))

    const sections = [
      `-- Ventrack data backup, generated ${new Date().toISOString()}\n` +
        '-- Data only: assumes this file is restored into a database that already\n' +
        "-- has Ventrack's schema (i.e. the same migrations this app ships).\n" +
        '-- Password hashes are not exported - restored accounts get a random\n' +
        '-- placeholder hash and need their password reset before signing in.\n',
      'BEGIN;\n',
      insertStatements('categories', ['id', 'name'], categories),
      insertStatements(
        'users',
        ['id', 'username', 'password_hash', 'created_at'],
        users.map((user) => ({
          id: user.id,
          username: user.username,
          password_hash: placeholderPasswordHash,
          created_at: user.createdAt
        }))
      ),
      insertStatements(
        'items',
        [
          'id',
          'name',
          'category_id',
          'unit',
          'quantity',
          'min_qty',
          'created_by',
          'created_at',
          'updated_at'
        ],
        items.map((item) => ({
          id: item.id,
          name: item.name,
          category_id: item.categoryId,
          unit: item.unit,
          quantity: item.quantity,
          min_qty: item.minQty,
          created_by: item.createdBy,
          created_at: item.createdAt,
          updated_at: item.updatedAt
        }))
      ),
      insertStatements(
        'stock_movements',
        ['id', 'item_id', 'type', 'quantity', 'note', 'user_id', 'created_at'],
        movements.map((movement) => ({
          id: movement.id,
          item_id: movement.itemId,
          type: movement.type,
          quantity: movement.quantity,
          note: movement.note,
          user_id: movement.userId,
          created_at: movement.createdAt
        }))
      ),
      sequenceResetStatement('categories', categories),
      sequenceResetStatement('users', users),
      sequenceResetStatement('items', items),
      sequenceResetStatement('stock_movements', movements),
      'COMMIT;\n'
    ]

    await mkdir(folder, { recursive: true })
    const filePath = join(folder, sqlBackupFileName())
    await writeFile(filePath, sections.join('\n'))

    return { filePath }
  } catch (error) {
    throw toServiceError(error)
  }
}
