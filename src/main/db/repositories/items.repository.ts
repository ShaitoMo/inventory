import { and, eq, ilike, lte, sql } from 'drizzle-orm'
import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../schema'

type Db = PgliteDatabase<typeof schema>
type Item = typeof schema.items.$inferSelect
type Category = typeof schema.categories.$inferSelect

export type ListItemsFilters = {
  search?: string
  categoryId?: number
  lowStock?: boolean
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 20

export async function listItems(
  db: Db,
  filters: ListItemsFilters = {}
): Promise<{ items: Item[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE

  const conditions = [
    filters.search ? ilike(schema.items.name, `%${filters.search}%`) : undefined,
    filters.categoryId !== undefined ? eq(schema.items.categoryId, filters.categoryId) : undefined,
    filters.lowStock ? lte(schema.items.quantity, schema.items.minQty) : undefined
  ].filter((condition) => condition !== undefined)
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [items, [{ count }]] = await Promise.all([
    db
      .select()
      .from(schema.items)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.items)
      .where(where)
  ])

  return { items, total: count }
}

export async function getItem(
  db: Db,
  id: number
): Promise<(Item & { category: Category }) | undefined> {
  const [row] = await db
    .select({ item: schema.items, category: schema.categories })
    .from(schema.items)
    .innerJoin(schema.categories, eq(schema.items.categoryId, schema.categories.id))
    .where(eq(schema.items.id, id))

  if (!row) return undefined
  return { ...row.item, category: row.category }
}

export async function updateItem(
  db: Db,
  id: number,
  input: { name?: string; categoryId?: number; unit?: string; minQty?: number }
): Promise<Item> {
  const [item] = await db
    .update(schema.items)
    .set({
      name: input.name,
      categoryId: input.categoryId,
      unit: input.unit,
      minQty: input.minQty,
      updatedAt: sql`now()`
    })
    .where(eq(schema.items.id, id))
    .returning()

  return item
}

export async function createItem(
  db: Db,
  input: {
    name: string
    categoryId: number
    createdBy: number
    unit?: string
    minQty?: number
  }
): Promise<Item> {
  const [item] = await db.insert(schema.items).values(input).returning()
  return item
}

export async function deleteItem(db: Db, id: number): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.stockMovements)
    .where(eq(schema.stockMovements.itemId, id))

  if (count > 0) {
    throw new Error('Cannot delete an item with existing movements')
  }

  await db.delete(schema.items).where(eq(schema.items.id, id))
}

export async function lowStockItems(db: Db): Promise<Item[]> {
  return db.select().from(schema.items).where(lte(schema.items.quantity, schema.items.minQty))
}
