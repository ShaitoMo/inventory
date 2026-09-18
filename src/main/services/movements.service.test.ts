import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/testDb'
import { seedUser } from '../db/testFixtures'
import { NotFoundError } from './errors'
import { createMovement } from './movements.service'

describe('createMovement', () => {
  it('throws a NotFoundError when the item does not exist', async () => {
    const db = await createTestDb()
    const user = await seedUser(db)

    await expect(
      createMovement(db, { itemId: 999, type: 'in', quantity: 5, userId: user.id })
    ).rejects.toThrow(NotFoundError)
  })
})
