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
  it('returns an empty result when there are no users', async () => {
    const db = await createTestDb()

    const result = await listUsers(db)

    expect(result).toEqual({ users: [], total: 0 })
  })

  it('orders alphabetically by username and paginates', async () => {
    const db = await createTestDb()
    await createUser(db, { username: 'zoe', password: 'correct horse battery staple' })
    await createUser(db, { username: 'ada', password: 'correct horse battery staple' })
    await createUser(db, { username: 'mo', password: 'correct horse battery staple' })

    const firstPage = await listUsers(db, { page: 1, pageSize: 2 })
    expect(firstPage.total).toBe(3)
    expect(firstPage.users.map((u) => u.username)).toEqual(['ada', 'mo'])

    const secondPage = await listUsers(db, { page: 2, pageSize: 2 })
    expect(secondPage.users.map((u) => u.username)).toEqual(['zoe'])
  })
})

describe('createUser', () => {
  it('creates a user and returns it without the password hash', async () => {
    const db = await createTestDb()

    const user = await createUser(db, {
      username: 'ada',
      password: 'correct horse battery staple'
    })

    expect(user).toMatchObject({ username: 'ada' })
    expect(user).not.toHaveProperty('passwordHash')

    const users = await listUsers(db)
    expect(users.total).toBe(1)
  })
})

describe('updateUser', () => {
  it('updates the given fields and returns the updated user', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
      username: 'ada',
      password: 'correct horse battery staple'
    })

    const updated = await updateUser(db, created.id, { username: 'ada.king' })

    expect(updated).toMatchObject({ id: created.id, username: 'ada.king' })
  })
})

describe('changePassword', () => {
  it('replaces the password so only the new one verifies', async () => {
    const db = await createTestDb()
    const created = await createUser(db, {
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
      username: 'ada',
      password: 'correct horse battery staple'
    })

    const user = await authenticateUser(db, 'ada', 'correct horse battery staple')

    expect(user).toMatchObject({ id: created.id, username: 'ada' })
    expect(user).not.toHaveProperty('passwordHash')
  })

  it('returns null when the password is wrong', async () => {
    const db = await createTestDb()
    await createUser(db, {
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
      username: 'ada',
      password: 'correct horse battery staple'
    })

    await deleteUser(db, created.id)

    expect(await listUsers(db)).toEqual({ users: [], total: 0 })
  })
})
