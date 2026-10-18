import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { Db } from '../db/types'
import * as reportsRepository from '../db/repositories/reports.repository'
import { addSheet, backupTimestamp } from './backup.service'
import { ValidationError, toServiceError } from './errors'

export type { MonthlyReport, MonthlyReportFilters } from '../db/repositories/reports.repository'

const MIN_YEAR = 2000
const MAX_YEAR = 2100

function validateMonth({ year, month }: reportsRepository.MonthlyReportFilters): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError('Month must be between 1 and 12')
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new ValidationError(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}`)
  }
}

export async function getMonthlyReport(
  db: Db,
  filters: reportsRepository.MonthlyReportFilters
): ReturnType<typeof reportsRepository.getMonthlyReport> {
  try {
    validateMonth(filters)
    return await reportsRepository.getMonthlyReport(db, filters)
  } catch (error) {
    throw toServiceError(error)
  }
}

const REPORT_COLUMNS = [
  { header: 'Item', key: 'name' },
  { header: 'Unit', key: 'unit' },
  { header: 'Opening', key: 'opening' },
  { header: 'In', key: 'in' },
  { header: 'Out', key: 'out' },
  { header: 'Adjust', key: 'adjust' },
  { header: 'Closing', key: 'closing' }
]

// Excel caps sheet names at 31 characters, rejects \ / ? * [ ] : and treats names as
// case-insensitively unique - category names are free text, so none of that is guaranteed.
function sheetName(categoryName: string, taken: Set<string>): string {
  const base = categoryName.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Category'
  let name = base
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  taken.add(name.toLowerCase())
  return name
}

export async function exportMonthlyReport(
  db: Db,
  folder: string,
  filters: reportsRepository.MonthlyReportFilters,
  now = new Date()
): Promise<{ filePath: string }> {
  try {
    validateMonth(filters)
    const report = await reportsRepository.getMonthlyReport(db, filters)

    const workbook = new ExcelJS.Workbook()
    const taken = new Set<string>()
    for (const category of report.categories) {
      const sheet = addSheet(workbook, sheetName(category.categoryName, taken), REPORT_COLUMNS, [
        ...category.items,
        { name: 'Total', unit: '', ...category.totals }
      ])
      sheet.getRow(sheet.rowCount).font = { bold: true }
    }
    // A workbook without any sheet is invalid, and a month can legitimately have no items yet.
    if (report.categories.length === 0) {
      addSheet(workbook, 'Report', REPORT_COLUMNS, [])
    }

    await mkdir(folder, { recursive: true })
    const month = `${report.year}-${String(report.month).padStart(2, '0')}`
    const filePath = join(folder, `ventrack-report-${month}_${backupTimestamp(now)}.xlsx`)
    await workbook.xlsx.writeFile(filePath)

    return { filePath }
  } catch (error) {
    throw toServiceError(error)
  }
}
