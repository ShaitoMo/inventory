import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema'
import { createTestDb } from '../testDb'
import { seedCategory, seedUser } from '../testFixtures'
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  lowStockItems,
  updateItem
} from './items.repository'

describe('listItems', () => {
  it('returns an empty result when there are no items', async () => {
    const db = await createTestDb()

    expect(await listItems(db)).toEqual({ items: [], total: 0 })
  })
})

describe('createItem', () => {
  it('creates an item with quantity defaulted to 0', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)

    const item = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    expect(item).toMatchObject({
      name: 'Coffee Beans',
      categoryId: category.id,
      unit: 'piece',
      quantity: 0,
      minQty: 10
    })

    const { items, total } = await listItems(db)
    expect(total).toBe(1)
    expect(items).toHaveLength(1)
  })
})

describe('getItem', () => {
  it('returns the item joined with its category', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db, 'Beverages')
    const user = await seedUser(db)
    const created = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    const item = await getItem(db, created.id)

    expect(item).toMatchObject({
      id: created.id,
      name: 'Coffee Beans',
      category: { id: category.id, name: 'Beverages' }
    })
  })

  it('returns undefined when the item does not exist', async () => {
    const db = await createTestDb()

    expect(await getItem(db, 999)).toBeUndefined()
  })
})

describe('updateItem', () => {
  it('updates name, category, unit, and min_qty', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db, 'Beverages')
    const otherCategory = await seedCategory(db, 'Snacks')
    const user = await seedUser(db)
    const created = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    const updated = await updateItem(db, created.id, {
      name: 'Ground Coffee',
      categoryId: otherCategory.id,
      unit: 'carton',
      minQty: 5
    })

    expect(updated).toMatchObject({
      name: 'Ground Coffee',
      categoryId: otherCategory.id,
      unit: 'carton',
      minQty: 5,
      quantity: 0
    })
  })

  it('never changes quantity, even if a caller passes it', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const created = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    const updated = await updateItem(db, created.id, {
      name: 'Coffee Beans',
      quantity: 999
    } as never)

    expect(updated.quantity).toBe(0)
  })
})

describe('deleteItem', () => {
  it('removes the item when no movements exist', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const created = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    await deleteItem(db, created.id)

    expect((await listItems(db)).items).toEqual([])
  })

  it('throws when movements exist for the item', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const created = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })
    await db
      .insert(schema.stockMovements)
      .values({ itemId: created.id, type: 'in', quantity: 5, userId: user.id })

    await expect(deleteItem(db, created.id)).rejects.toThrow()
    expect((await listItems(db)).items).toHaveLength(1)
  })
})

describe('lowStockItems', () => {
  it('returns only items at or below their min_qty', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const low = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id,
      minQty: 10
    })
    const healthy = await createItem(db, {
      name: 'Tea Bags',
      categoryId: category.id,
      createdBy: user.id,
      minQty: 10
    })
    await db.update(schema.items).set({ quantity: 5 }).where(eq(schema.items.id, low.id))
    await db.update(schema.items).set({ quantity: 50 }).where(eq(schema.items.id, healthy.id))

    const result = await lowStockItems(db)

    expect(result.map((item) => item.id)).toEqual([low.id])
  })
})
