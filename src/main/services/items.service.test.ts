import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { seedCategory, seedUser } from '../db/testFixtures'
import { listItems } from '../db/repositories/items.repository'
import { createItem } from './items.service'

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
    ).rejects.toThrow('Category not found')

    expect((await listItems(db)).items).toEqual([])
  })
})
