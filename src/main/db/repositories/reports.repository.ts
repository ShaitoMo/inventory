import { asc, eq, gte, lt, sql } from 'drizzle-orm'
import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../schema'

type Db = PgliteDatabase<typeof schema>

export type MonthlyReportFilters = {
  year: number
  month: number
  // Leave out items that had no stock movement at all in the month, and categories left empty.
  onlyWithMovements?: boolean
}

export type MonthlyReportRow = {
  opening: number
  in: number
  out: number
  adjust: number
  closing: number
}

export type MonthlyReportItem = MonthlyReportRow & { itemId: number; name: string; unit: string }

export type MonthlyReportCategory = {
  categoryId: number
  categoryName: string
  items: MonthlyReportItem[]
  totals: MonthlyReportRow
}

export type MonthlyReport = {
  year: number
  month: number
  categories: MonthlyReportCategory[]
}

/**
 * Per-item stock summary for one calendar month, grouped by category.
 *
 * The month is a half-open window [first of month, first of next month) in the machine's local
 * time, so it matches the dates the Movements window shows. Balances are not stored historically:
 * `closing` is the current quantity minus everything that happened from the end of the month
 * onwards, and `opening` is `closing` minus the month's own net change.
 */
export async function getMonthlyReport(
  db: Db,
  { year, month, onlyWithMovements }: MonthlyReportFilters
): Promise<MonthlyReport> {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)

  const movement = schema.stockMovements
  const inMonth = sql`${gte(movement.createdAt, from)} and ${lt(movement.createdAt, to)}`

  const rows = await db
    .select({
      itemId: schema.items.id,
      name: schema.items.name,
      unit: schema.items.unit,
      categoryId: schema.categories.id,
      categoryName: schema.categories.name,
      current: schema.items.quantity,
      inQty: sql<number>`coalesce(sum(${movement.quantity}) filter (where ${inMonth} and ${movement.type} = 'in'), 0)::int`,
      outQty: sql<number>`coalesce(sum(${movement.quantity}) filter (where ${inMonth} and ${movement.type} = 'out'), 0)::int`,
      adjustQty: sql<number>`coalesce(sum(${movement.quantity}) filter (where ${inMonth} and ${movement.type} = 'adjust'), 0)::int`,
      netAfter: sql<number>`coalesce(sum(case when ${movement.type} = 'out' then -${movement.quantity} else ${movement.quantity} end) filter (where ${gte(movement.createdAt, to)}), 0)::int`
    })
    .from(schema.items)
    .innerJoin(schema.categories, eq(schema.items.categoryId, schema.categories.id))
    .leftJoin(movement, eq(movement.itemId, schema.items.id))
    .where(lt(schema.items.createdAt, to))
    .groupBy(schema.items.id, schema.categories.id)
    // A count, not a sum of quantities: a +5 and a -5 recount net to 0 but are still movements.
    .having(
      onlyWithMovements ? sql`count(${movement.id}) filter (where ${inMonth}) > 0` : undefined
    )
    .orderBy(asc(schema.categories.name), asc(schema.items.name))

  const categories = new Map<number, MonthlyReportCategory>()
  for (const row of rows) {
    const closing = row.current - row.netAfter
    const opening = closing - (row.inQty - row.outQty + row.adjustQty)

    let category = categories.get(row.categoryId)
    if (!category) {
      category = {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        items: [],
        totals: { opening: 0, in: 0, out: 0, adjust: 0, closing: 0 }
      }
      categories.set(row.categoryId, category)
    }

    category.items.push({
      itemId: row.itemId,
      name: row.name,
      unit: row.unit,
      opening,
      in: row.inQty,
      out: row.outQty,
      adjust: row.adjustQty,
      closing
    })
    category.totals.opening += opening
    category.totals.in += row.inQty
    category.totals.out += row.outQty
    category.totals.adjust += row.adjustQty
    category.totals.closing += closing
  }

  return { year, month, categories: [...categories.values()] }
}
