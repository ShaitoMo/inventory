import { describe, expect, it } from 'vitest'
import { createTestDb } from '../testDb'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from './categories.repository'

describe('listCategories', () => {
  it('returns an empty list when there are no categories', async () => {
    const db = await createTestDb()

    expect(await listCategories(db)).toEqual([])
  })
})

describe('createCategory', () => {
  it('creates a category and returns it', async () => {
    const db = await createTestDb()

    const category = await createCategory(db, { name: 'Beverages' })

    expect(category).toMatchObject({ name: 'Beverages' })
    expect(await listCategories(db)).toHaveLength(1)
  })
})

describe('updateCategory', () => {
  it('updates the name and returns the updated category', async () => {
    const db = await createTestDb()
    const created = await createCategory(db, { name: 'Beverages' })

    const updated = await updateCategory(db, created.id, { name: 'Drinks' })

    expect(updated).toMatchObject({ id: created.id, name: 'Drinks' })
  })
})

describe('deleteCategory', () => {
  it('removes the category', async () => {
    const db = await createTestDb()
    const created = await createCategory(db, { name: 'Beverages' })

    await deleteCategory(db, created.id)

    expect(await listCategories(db)).toEqual([])
  })
})
