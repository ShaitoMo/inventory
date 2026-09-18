import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { NotFoundError } from './errors'
import { deleteUser, updateUser } from './users.service'

describe('updateUser', () => {
  it('throws a NotFoundError when the user does not exist', async () => {
    const db = await createTestDb()

    await expect(updateUser(db, 999, { name: 'Ada' })).rejects.toThrow(NotFoundError)
  })
})

describe('deleteUser', () => {
  it('throws a NotFoundError when the user does not exist', async () => {
    const db = await createTestDb()

    await expect(deleteUser(db, 999)).rejects.toThrow(NotFoundError)
  })
})
