import { describe, expect, it } from 'vitest'
import { createTestDb } from '../testDb'
import {
  authenticateUser,
  changePassword,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  verifyPassword
} from './users.repository'

describe('listUsers', () => {
  it('returns an empty list when there are no users', async () => {
    const db = await createTestDb()

    const result = await listUsers(db)

    expect(result).toEqual([])
  })
})

describe('createUser', () => {
  it('creates a user and returns it without the password hash', async () => {
    const db = await createTestDb()

    const user = await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'correct horse battery staple'
    })

    expect(user).toMatchObject({ name: 'Ada Lovelace', username: 'ada' })
    expect(user).not.toHaveProperty('passwordHash')

    const users = await listUsers(db)
    expect(users).toHaveLength(1)
  })
})

describe('updateUser', () => {
  it('updates the given fields and returns the updated user', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'correct horse battery staple'
    })

    const updated = await updateUser(db, created.id, { name: 'Ada King' })

    expect(updated).toMatchObject({ id: created.id, name: 'Ada King', username: 'ada' })
  })
})

describe('changePassword', () => {
  it('replaces the password so only the new one verifies', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'old password'
    })

    await changePassword(db, created.id, 'new password')

    expect(await verifyPassword(db, 'ada', 'new password')).toBe(true)
    expect(await verifyPassword(db, 'ada', 'old password')).toBe(false)
  })
})

describe('authenticateUser', () => {
  it('returns the public user when the password matches', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'correct horse battery staple'
    })

    const user = await authenticateUser(db, 'ada', 'correct horse battery staple')

    expect(user).toMatchObject({ id: created.id, name: 'Ada Lovelace', username: 'ada' })
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('returns null when the password is wrong', async () => {
    const db = await createTestDb()
    await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'correct horse battery staple'
    })

    expect(await authenticateUser(db, 'ada', 'wrong password')).toBeNull()
  })

  it('returns null when the username is unknown', async () => {
    const db = await createTestDb()

    expect(await authenticateUser(db, 'nobody', 'anything')).toBeNull()
  })
})

describe('deleteUser', () => {
  it('removes the user', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
      name: 'Ada Lovelace',
      username: 'ada',
      password: 'correct horse battery staple'
    })

    await deleteUser(db, created.id)

    expect(await listUsers(db)).toEqual([])
  })
})
