import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { ValidationError } from './errors'
import { getMonthlyReport } from './reports.service'

describe('getMonthlyReport', () => {
  // Validation never touches the database, so one throwaway instance serves every case.
  let db: Awaited<ReturnType<typeof createTestDb>>

  beforeAll(async () => {
    db = await createTestDb()
  })

  it.each([0, 13, -1, 1.5, Number.NaN])('rejects month %s with a ValidationError', async (month) => {
    await expect(getMonthlyReport(db, { year: 2026, month })).rejects.toThrow(ValidationError)
  })

  it.each([1999, 2101, 26, Number.NaN])('rejects year %s with a ValidationError', async (year) => {
    await expect(getMonthlyReport(db, { year, month: 3 })).rejects.toThrow(ValidationError)
  })

  it('returns an empty report for a valid month with no data', async () => {
    await expect(getMonthlyReport(db, { year: 2026, month: 3 })).resolves.toEqual({
      year: 2026,
      month: 3,
      categories: []
    })
  })
})
