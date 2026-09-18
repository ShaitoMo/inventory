import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { NotFoundError } from './errors'
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
})
