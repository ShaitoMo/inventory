import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../schema'

type Db = PgliteDatabase<typeof schema>
type Movement = typeof schema.stockMovements.$inferSelect

export async function createMovement(
  db: Db,
  input: { itemId: number; type: 'in' | 'out'; quantity: number; note?: string; userId: number }
): Promise<Movement> {
  if (input.type !== 'in' && input.type !== 'out') {
    throw new Error('createMovement only accepts type "in" or "out"; use recount for "adjust"')
  }

  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({ quantity: schema.items.quantity })
      .from(schema.items)
      .where(eq(schema.items.id, input.itemId))

    if (!item) {
      throw new Error('Item not found')
    }

    const nextQuantity =
      input.type === 'in' ? item.quantity + input.quantity : item.quantity - input.quantity

    if (nextQuantity < 0) {
      throw new Error('Movement would take quantity below zero')
    }

    const [movement] = await tx
      .insert(schema.stockMovements)
      .values({
        itemId: input.itemId,
        type: input.type,
        quantity: input.quantity,
        note: input.note,
        userId: input.userId
      })
      .returning()

    await tx
      .update(schema.items)
      .set({ quantity: nextQuantity, updatedAt: sql`now()` })
      .where(eq(schema.items.id, input.itemId))

    return movement
  })
}

export async function listMovementsByItem(db: Db, itemId: number): Promise<Movement[]> {
  return db
    .select()
    .from(schema.stockMovements)
    .where(eq(schema.stockMovements.itemId, itemId))
    .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
}

export type ListMovementsFilters = {
  from?: Date
  to?: Date
  type?: 'in' | 'out' | 'adjust'
  userId?: number
  categoryId?: number
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 20

export async function listMovements(
  db: Db,
  filters: ListMovementsFilters = {}
): Promise<{ movements: Movement[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE

  const conditions = [
    filters.from ? gte(schema.stockMovements.createdAt, filters.from) : undefined,
    filters.to ? lte(schema.stockMovements.createdAt, filters.to) : undefined,
    filters.type ? eq(schema.stockMovements.type, filters.type) : undefined,
    filters.userId !== undefined ? eq(schema.stockMovements.userId, filters.userId) : undefined,
    filters.categoryId !== undefined ? eq(schema.items.categoryId, filters.categoryId) : undefined
  ].filter((condition) => condition !== undefined)
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ movement: schema.stockMovements })
      .from(schema.stockMovements)
      .innerJoin(schema.items, eq(schema.stockMovements.itemId, schema.items.id))
      .where(where)
      .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.stockMovements)
      .innerJoin(schema.items, eq(schema.stockMovements.itemId, schema.items.id))
      .where(where)
  ])

  return { movements: rows.map((row) => row.movement), total: count }
}

export async function recount(
  db: Db,
  input: { itemId: number; countedQuantity: number; userId: number; note?: string }
): Promise<Movement | undefined> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({ quantity: schema.items.quantity })
      .from(schema.items)
      .where(eq(schema.items.id, input.itemId))

    if (!item) {
      throw new Error('Item not found')
    }

    const diff = input.countedQuantity - item.quantity
    if (diff === 0) return undefined

    const [movement] = await tx
      .insert(schema.stockMovements)
      .values({
        itemId: input.itemId,
        type: 'adjust',
        quantity: Math.abs(diff),
        note: input.note,
        userId: input.userId
      })
      .returning()

    await tx
      .update(schema.items)
      .set({ quantity: input.countedQuantity, updatedAt: sql`now()` })
      .where(eq(schema.items.id, input.itemId))

    return movement
  })
}
