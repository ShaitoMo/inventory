import { Db } from './db/types'
import { authenticateUser } from './services/users.service'
import { UnauthorizedError } from './services/errors'

type PublicUser = NonNullable<Awaited<ReturnType<typeof authenticateUser>>>

let currentUser: PublicUser | null = null

export async function login(db: Db, username: string, password: string): Promise<PublicUser> {
  const user = await authenticateUser(db, username, password)
  if (!user) {
    throw new UnauthorizedError('Invalid username or password')
  }

  currentUser = user
  return user
}

export function logout(): void {
  currentUser = null
}

export function getCurrentUser(): PublicUser | null {
  return currentUser
}

export function requireCurrentUser(): PublicUser {
  if (!currentUser) {
    throw new UnauthorizedError('Not logged in')
  }
  return currentUser
}
