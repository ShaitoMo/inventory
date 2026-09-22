import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { seedUser } from '../db/testFixtures'
import { createCategory } from '../db/repositories/categories.repository'
import { createItem } from '../db/repositories/items.repository'
import { NotFoundError, ValidationError } from './errors'
import { deleteCategory, updateCategory } from './categories.service'

describe('updateCategory', () => {
  it('throws a NotFoundError when the category does not exist', async () => {
    const db = await createTestDb()

    await expect(updateCategory(db, 999, { name: 'Drinks' })).rejects.toThrow(NotFoundError)
  })
})

describe('deleteCategory', () => {
  it('throws a NotFoundError when the category does not exist', async () => {
    const db = await createTestDb()

    await expect(deleteCategory(db, 999)).rejects.toThrow(NotFoundError)
  })

  it('throws a ValidationError when the category has existing items', async () => {
    const db = await createTestDb()
    const category = await createCategory(db, { name: 'Beverages' })
    const user = await seedUser(db)
    await createItem(db, { name: 'Coffee Beans', categoryId: category.id, createdBy: user.id })

    await expect(deleteCategory(db, category.id)).rejects.toThrow(ValidationError)
  })
})
