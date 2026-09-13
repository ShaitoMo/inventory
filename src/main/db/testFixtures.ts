import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'
import { createCategory } from './repositories/categories.repository'
import { createUser } from './repositories/users.repository'

type Db = PgliteDatabase<typeof schema>

export async function seedCategory(db: Db, name = 'Beverages'): ReturnType<typeof createCategory> {
  return createCategory(db, { name })
}

export async function seedUser(
  db: Db,
  overrides: Partial<{ name: string; username: string }> = {}
): ReturnType<typeof createUser> {
  return createUser(db, {
    name: overrides.name ?? 'Ada Lovelace',
    username: overrides.username ?? 'ada',
    password: 'correct horse battery staple'
  })
}
