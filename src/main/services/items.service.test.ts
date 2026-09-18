import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { seedCategory, seedUser } from '../db/testFixtures'
import { listItems } from '../db/repositories/items.repository'
import { createMovement } from '../db/repositories/movements.repository'
import { NotFoundError, ValidationError } from './errors'
import { createItem, deleteItem, updateItem } from './items.service'

describe('createItem', () => {
  it('creates the item when the referenced category exists', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)

    const item = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })

    expect(item).toMatchObject({ name: 'Coffee Beans', categoryId: category.id })
  })

  it('throws "Category not found" and does not insert a row when the category does not exist', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)

    await expect(
      createItem(db, { name: 'Coffee Beans', categoryId: 999, createdBy: user.id })
    ).rejects.toThrow(NotFoundError)

    expect((await listItems(db)).items).toEqual([])
  })
})

describe('deleteItem', () => {
  it('throws a ValidationError when the item has movement history', async () => {
    const db = await createTestDb()
    const category = await seedCategory(db)
    const user = await seedUser(db)
    const item = await createItem(db, {
      name: 'Coffee Beans',
      categoryId: category.id,
      createdBy: user.id
    })
    await createMovement(db, { itemId: item.id, type: 'in', quantity: 5, userId: user.id })

    await expect(deleteItem(db, item.id)).rejects.toThrow(ValidationError)
  })

  it('throws a NotFoundError when the item does not exist', async () => {
    const db = await createTestDb()

    await expect(deleteItem(db, 999)).rejects.toThrow(NotFoundError)
  })
})

describe('updateItem', () => {
  it('throws a NotFoundError when the item does not exist', async () => {
    const db = await createTestDb()

    await expect(updateItem(db, 999, { name: 'Ground Coffee' })).rejects.toThrow(NotFoundError)
  })
})
