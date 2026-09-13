import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { createTestDb } from '../testDb'
import { seedCategory, seedUser } from '../testFixtures'
import { createItem } from './items.repository'
import { createMovement, listMovements, listMovementsByItem, recount } from './movements.repository'

async function seedItem(db: Awaited<ReturnType<typeof createTestDb>>): Promise<{
  item: Awaited<ReturnType<typeof createItem>>
  user: Awaited<ReturnType<typeof seedUser>>
}> {
  const category = await seedCategory(db)
  const user = await seedUser(db)
  const item = await createItem(db, {
    name: 'Coffee Beans',
    categoryId: category.id,
    createdBy: user.id
  })
  return { item, user }
}

async function currentQuantity(
  db: Awaited<ReturnType<typeof createTestDb>>,
  itemId: number
): Promise<number> {
  const [row] = await db
    .select({ quantity: schema.items.quantity })
    .from(schema.items)
    .where(eq(schema.items.id, itemId))
  return row.quantity
}

describe('createMovement', () => {
  it('increases item quantity for an "in" movement', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)

    const movement = await createMovement(db, {
      itemId: item.id,
      type: 'in',
      quantity: 10,
      userId: user.id
    })

    expect(movement).toMatchObject({ itemId: item.id, type: 'in', quantity: 10 })
    expect(await currentQuantity(db, item.id)).toBe(10)
  })

  it('decreases item quantity for an "out" movement', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 10, userId: user.id })

    await createMovement(db, { itemId: item.id, type: 'out', quantity: 4, userId: user.id })

    expect(await currentQuantity(db, item.id)).toBe(6)
  })

  it('rejects an "out" movement that would take quantity below zero', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)

    await expect(
      createMovement(db, { itemId: item.id, type: 'out', quantity: 1, userId: user.id })
    ).rejects.toThrow()
    expect(await currentQuantity(db, item.id)).toBe(0)
  })

  it('rejects type "adjust"', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)

    await expect(
      createMovement(db, { itemId: item.id, type: 'adjust', quantity: 1, userId: user.id } as never)
    ).rejects.toThrow()
  })
})

describe('recount', () => {
  it('writes one adjust movement for the difference and sets quantity to the counted value', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 10, userId: user.id })

    const movement = await recount(db, { itemId: item.id, countedQuantity: 7, userId: user.id })

    expect(movement).toMatchObject({ itemId: item.id, type: 'adjust', quantity: 3 })
    expect(await currentQuantity(db, item.id)).toBe(7)
  })

  it('does nothing when the counted quantity matches the current quantity', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 10, userId: user.id })

    const movement = await recount(db, { itemId: item.id, countedQuantity: 10, userId: user.id })

    expect(movement).toBeUndefined()
    expect(await currentQuantity(db, item.id)).toBe(10)
  })
})

describe('listMovementsByItem', () => {
  it("returns one item's history, newest first", async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 10, userId: user.id })
    await createMovement(db, { itemId: item.id, type: 'out', quantity: 4, userId: user.id })

    const history = await listMovementsByItem(db, item.id)

    expect(history.map((m) => m.type)).toEqual(['out', 'in'])
  })
})

describe('listMovements', () => {
  it('filters by type, user, and category', async () => {
    const db = await createTestDb()
    const categoryA = await seedCategory(db, 'Beverages')
    const categoryB = await seedCategory(db, 'Snacks')
    const userA = await seedUser(db, { username: 'ada' })
    const userB = await seedUser(db, { username: 'grace' })
    const itemA = await createItem(db, {
      name: 'Coffee',
      categoryId: categoryA.id,
      createdBy: userA.id
    })
    const itemB = await createItem(db, {
      name: 'Chips',
      categoryId: categoryB.id,
      createdBy: userA.id
    })
    await createMovement(db, { itemId: itemA.id, type: 'in', quantity: 10, userId: userA.id })
    await createMovement(db, { itemId: itemB.id, type: 'in', quantity: 5, userId: userB.id })
    await createMovement(db, { itemId: itemA.id, type: 'out', quantity: 2, userId: userA.id })

    expect((await listMovements(db)).total).toBe(3)

    const byType = await listMovements(db, { type: 'out' })
    expect(byType.total).toBe(1)
    expect(byType.movements[0]).toMatchObject({ itemId: itemA.id, type: 'out' })

    const byUser = await listMovements(db, { userId: userB.id })
    expect(byUser.total).toBe(1)
    expect(byUser.movements[0]).toMatchObject({ itemId: itemB.id })

    const byCategory = await listMovements(db, { categoryId: categoryB.id })
    expect(byCategory.total).toBe(1)
    expect(byCategory.movements[0]).toMatchObject({ itemId: itemB.id })
  })

  it('filters by date range', async () => {
    const db = await createTestDb()
    const { item, user } = await seedItem(db)
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 10, userId: user.id })
    const oneMinuteFromNow = new Date(Date.now() + 60_000)

    expect((await listMovements(db, { from: oneMinuteFromNow })).total).toBe(0)
    expect((await listMovements(db, { to: oneMinuteFromNow })).total).toBe(1)
  })
})
