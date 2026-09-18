import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from './db/testDb'
import { seedUser } from './db/testFixtures'
import { UnauthorizedError } from './services/errors'
import { getCurrentUser, login, logout, requireCurrentUser } from './session'

beforeEach(() => {
  logout()
})

describe('login', () => {
  it('sets the current user and returns it when credentials are correct', async () => {
    const db = await createTestDb()
    const user = await seedUser(db, { username: 'ada' })

    const result = await login(db, 'ada', 'correct horse battery staple')

    expect(result).toMatchObject({ id: user.id, username: 'ada' })
    expect(getCurrentUser()).toMatchObject({ id: user.id, username: 'ada' })
  })

  it('throws an UnauthorizedError and leaves no session when credentials are wrong', async () => {
    const db = await createTestDb()
    await seedUser(db, { username: 'ada' })

    await expect(login(db, 'ada', 'wrong password')).rejects.toThrow(UnauthorizedError)
    expect(getCurrentUser()).toBeNull()
  })
})

describe('logout', () => {
  it('clears the current user', async () => {
    const db = await createTestDb()
    await seedUser(db, { username: 'ada' })
    await login(db, 'ada', 'correct horse battery staple')

    logout()

    expect(getCurrentUser()).toBeNull()
  })
})

describe('requireCurrentUser', () => {
  it('returns the current user when logged in', async () => {
    const db = await createTestDb()
    const user = await seedUser(db, { username: 'ada' })
    await login(db, 'ada', 'correct horse battery staple')

    expect(requireCurrentUser()).toMatchObject({ id: user.id, username: 'ada' })
  })

  it('throws an UnauthorizedError when nobody is logged in', () => {
    expect(() => requireCurrentUser()).toThrow(UnauthorizedError)
  })
})
