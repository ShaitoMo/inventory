import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { createTestDb } from '../testDb'
import { seedCategory, seedUser } from '../testFixtures'
import { createItem } from './items.repository'
import { getMonthlyReport } from './reports.repository'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

// createMovement can't backdate, so reports tests write history directly. Dates are built with
// the local-time constructor so the tests behave the same in any timezone.
async function seedItem(
  db: TestDb,
  input: { name: string; categoryId: number; userId: number; quantity: number; createdAt?: Date }
): Promise<number> {
  const item = await createItem(db, {
    name: input.name,
    categoryId: input.categoryId,
    createdBy: input.userId
  })
  await db
    .update(schema.items)
    .set({ quantity: input.quantity, createdAt: input.createdAt ?? new Date(2020, 0, 1) })
    .where(eq(schema.items.id, item.id))
  return item.id
}

async function addMovement(
  db: TestDb,
  input: {
    itemId: number
    userId: number
    type: 'in' | 'out' | 'adjust'
    quantity: number
    createdAt: Date
  }
): Promise<void> {
  await db.insert(schema.stockMovements).values(input)
}

describe('getMonthlyReport', () => {
  it('derives opening and closing from movements before, inside and after the month', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const category = await seedCategory(db)
    // 100 + 50 - 30 - 5 - 10 + 4 = 109 right now
    const itemId = await seedItem(db, {
      name: 'Coffee',
      categoryId: category.id,
      userId: user.id,
      quantity: 109
    })
    const base = { itemId, userId: user.id }
    await addMovement(db, { ...base, type: 'in', quantity: 100, createdAt: new Date(2026, 1, 10) })
    await addMovement(db, { ...base, type: 'in', quantity: 50, createdAt: new Date(2026, 2, 5) })
    await addMovement(db, { ...base, type: 'out', quantity: 30, createdAt: new Date(2026, 2, 12) })
    await addMovement(db, {
      ...base,
      type: 'adjust',
      quantity: -5,
      createdAt: new Date(2026, 2, 20)
    })
    await addMovement(db, { ...base, type: 'out', quantity: 10, createdAt: new Date(2026, 3, 3) })
    await addMovement(db, { ...base, type: 'in', quantity: 4, createdAt: new Date(2026, 3, 20) })

    const report = await getMonthlyReport(db, { year: 2026, month: 3 })

    expect(report.year).toBe(2026)
    expect(report.month).toBe(3)
    expect(report.categories).toHaveLength(1)
    expect(report.categories[0].items).toEqual([
      {
        itemId,
        name: 'Coffee',
        unit: 'piece',
        opening: 100,
        in: 50,
        out: 30,
        adjust: -5,
        closing: 115
      }
    ])
  })

  it('chains months: one month closes at the balance the next one opens with', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const category = await seedCategory(db)
    const itemId = await seedItem(db, {
      name: 'Coffee',
      categoryId: category.id,
      userId: user.id,
      quantity: 70
    })
    const base = { itemId, userId: user.id }
    await addMovement(db, { ...base, type: 'in', quantity: 100, createdAt: new Date(2026, 1, 10) })
    await addMovement(db, { ...base, type: 'out', quantity: 30, createdAt: new Date(2026, 2, 12) })

    const feb = await getMonthlyReport(db, { year: 2026, month: 2 })
    const mar = await getMonthlyReport(db, { year: 2026, month: 3 })

    expect(feb.categories[0].items[0]).toMatchObject({ opening: 0, closing: 100 })
    expect(mar.categories[0].items[0]).toMatchObject({ opening: 100, closing: 70 })
  })

  it('includes a movement at the start of the month and excludes one at the start of the next', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const category = await seedCategory(db)
    // 5 (on 1 Mar 00:00) + 7 (on 1 Apr 00:00)
    const itemId = await seedItem(db, {
      name: 'Coffee',
      categoryId: category.id,
      userId: user.id,
      quantity: 12
    })
    const base = { itemId, userId: user.id, type: 'in' as const }
    await addMovement(db, { ...base, quantity: 5, createdAt: new Date(2026, 2, 1, 0, 0, 0, 0) })
    await addMovement(db, { ...base, quantity: 7, createdAt: new Date(2026, 3, 1, 0, 0, 0, 0) })

    const report = await getMonthlyReport(db, { year: 2026, month: 3 })

    expect(report.categories[0].items[0]).toMatchObject({
      opening: 0,
      in: 5,
      closing: 5
    })
  })

  it('lists idle items, tolerates negative balances, and skips items created after the month', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const category = await seedCategory(db, 'Beverages')
    const frozen = await seedCategory(db, 'Frozen')

    await seedItem(db, { name: 'Water', categoryId: category.id, userId: user.id, quantity: 7 })
    const teaId = await seedItem(db, {
      name: 'Tea',
      categoryId: category.id,
      userId: user.id,
      quantity: -3
    })
    await addMovement(db, {
      itemId: teaId,
      userId: user.id,
      type: 'out',
      quantity: 3,
      createdAt: new Date(2026, 2, 9)
    })
    await seedItem(db, {
      name: 'Ice Cream',
      categoryId: frozen.id,
      userId: user.id,
      quantity: 20,
      createdAt: new Date(2026, 3, 15)
    })

    const report = await getMonthlyReport(db, { year: 2026, month: 3 })

    // "Frozen" has only an item created after March, so the whole category is omitted.
    expect(report.categories.map((c) => c.categoryName)).toEqual(['Beverages'])
    expect(report.categories[0].items).toEqual([
      expect.objectContaining({ name: 'Tea', opening: 0, in: 0, out: 3, adjust: 0, closing: -3 }),
      expect.objectContaining({ name: 'Water', opening: 7, in: 0, out: 0, adjust: 0, closing: 7 })
    ])
  })

  it('groups by category ordered by name, and totals equal the sum of the rows', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)
    const snacks = await seedCategory(db, 'Snacks')
    const beverages = await seedCategory(db, 'Beverages')

    const chipsId = await seedItem(db, {
      name: 'Chips',
      categoryId: snacks.id,
      userId: user.id,
      quantity: 40
    })
    const colaId = await seedItem(db, {
      name: 'Cola',
      categoryId: beverages.id,
      userId: user.id,
      quantity: 25
    })
    const juiceId = await seedItem(db, {
      name: 'Apple Juice',
      categoryId: beverages.id,
      userId: user.id,
      quantity: 15
    })
    await addMovement(db, {
      itemId: colaId,
      userId: user.id,
      type: 'in',
      quantity: 30,
      createdAt: new Date(2026, 2, 2)
    })
    await addMovement(db, {
      itemId: colaId,
      userId: user.id,
      type: 'out',
      quantity: 5,
      createdAt: new Date(2026, 2, 3)
    })
    await addMovement(db, {
      itemId: juiceId,
      userId: user.id,
      type: 'out',
      quantity: 10,
      createdAt: new Date(2026, 2, 4)
    })
    await addMovement(db, {
      itemId: chipsId,
      userId: user.id,
      type: 'in',
      quantity: 40,
      createdAt: new Date(2026, 2, 5)
    })

    const report = await getMonthlyReport(db, { year: 2026, month: 3 })

    expect(report.categories.map((c) => c.categoryName)).toEqual(['Beverages', 'Snacks'])
    const [bev, snk] = report.categories
    expect(bev.items.map((i) => i.name)).toEqual(['Apple Juice', 'Cola'])
    // Apple Juice opens at 25 (15 now + the 10 that left); Cola opens at 0.
    expect(bev.totals).toEqual({ opening: 25, in: 30, out: 15, adjust: 0, closing: 40 })
    expect(snk.totals).toEqual({ opening: 0, in: 40, out: 0, adjust: 0, closing: 40 })
  })

  it('returns no categories when there are no items', async () => {
    const db = await createTestDb()

    const report = await getMonthlyReport(db, { year: 2026, month: 3 })

    expect(report).toEqual({ year: 2026, month: 3, categories: [] })
  })
})

describe('getMonthlyReport onlyWithMovements', () => {
  // March 2026 under test:
  //   Beverages: Cola moved, Water idle, Syrup only moved in February
  //   Misc:      Gum has a +5 and a -5 adjust in March (nets to 0, still two movements)
  //   Snacks:    Chips idle, so the whole category has nothing to show
  async function seedScenario(db: TestDb): Promise<void> {
    const user = await seedUser(db)
    const beverages = await seedCategory(db, 'Beverages')
    const misc = await seedCategory(db, 'Misc')
    const snacks = await seedCategory(db, 'Snacks')
    const base = { userId: user.id }

    const colaId = await seedItem(db, { name: 'Cola', categoryId: beverages.id, ...base, quantity: 25 })
    await seedItem(db, { name: 'Water', categoryId: beverages.id, ...base, quantity: 7 })
    const syrupId = await seedItem(db, {
      name: 'Syrup',
      categoryId: beverages.id,
      ...base,
      quantity: 3
    })
    const gumId = await seedItem(db, { name: 'Gum', categoryId: misc.id, ...base, quantity: 9 })
    await seedItem(db, { name: 'Chips', categoryId: snacks.id, ...base, quantity: 40 })

    await addMovement(db, { ...base, itemId: colaId, type: 'in', quantity: 30, createdAt: new Date(2026, 2, 2) })
    await addMovement(db, { ...base, itemId: colaId, type: 'out', quantity: 5, createdAt: new Date(2026, 2, 3) })
    await addMovement(db, { ...base, itemId: syrupId, type: 'in', quantity: 3, createdAt: new Date(2026, 1, 10) })
    await addMovement(db, { ...base, itemId: gumId, type: 'in', quantity: 9, createdAt: new Date(2026, 1, 1) })
    await addMovement(db, { ...base, itemId: gumId, type: 'adjust', quantity: 5, createdAt: new Date(2026, 2, 4) })
    await addMovement(db, { ...base, itemId: gumId, type: 'adjust', quantity: -5, createdAt: new Date(2026, 2, 6) })
  }

  it('drops idle items and categories left empty, and totals only the items kept', async () => {
    const db = await createTestDb()
    await seedScenario(db)

    const report = await getMonthlyReport(db, { year: 2026, month: 3, onlyWithMovements: true })

    expect(report.categories.map((c) => c.categoryName)).toEqual(['Beverages', 'Misc'])
    const [beverages, misc] = report.categories
    // Water (idle) and Syrup (only moved in February) are gone.
    expect(beverages.items.map((i) => i.name)).toEqual(['Cola'])
    expect(beverages.totals).toEqual({ opening: 0, in: 30, out: 5, adjust: 0, closing: 25 })
    // Gum's adjusts sum to 0 but they are still movements, so it stays.
    expect(misc.items).toEqual([
      expect.objectContaining({ name: 'Gum', opening: 9, in: 0, out: 0, adjust: 0, closing: 9 })
    ])
  })

  it('returns every item when the flag is false or absent', async () => {
    const db = await createTestDb()
    await seedScenario(db)

    const everything = await getMonthlyReport(db, { year: 2026, month: 3 })
    const explicitlyOff = await getMonthlyReport(db, {
      year: 2026,
      month: 3,
      onlyWithMovements: false
    })

    expect(explicitlyOff).toEqual(everything)
    expect(everything.categories.map((c) => c.categoryName)).toEqual(['Beverages', 'Misc', 'Snacks'])
    expect(everything.categories[0].items.map((i) => i.name)).toEqual(['Cola', 'Syrup', 'Water'])
  })

  it('returns no categories when nothing moved in the month', async () => {
    const db = await createTestDb()
    await seedScenario(db)

    const report = await getMonthlyReport(db, { year: 2026, month: 5, onlyWithMovements: true })

    expect(report.categories).toEqual([])
  })
})
