import { app } from 'electron'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

let db: PgliteDatabase<typeof schema> | null = null

// `migrationsFolder` is the caller's own `__dirname` + 'db/migrations'.
// Callers must compute it themselves rather than this module computing its
// own `__dirname`: that reflects wherever the bundler put *this* chunk,
// which varies (e.g. a shared chunk under out/main/chunks/ once more than
// one main entry imports this module) — but an entry file's own `__dirname`
// (index.ts, seed.ts) is always its actual location, out/main/.
export async function getDb(migrationsFolder: string): Promise<PgliteDatabase<typeof schema>> {
  if (db) return db

  const client = new PGlite(join(app.getPath('userData'), 'pgdata'))
  await client.exec("SET TIME ZONE 'UTC'")
  const instance = drizzle(client, { schema })

  await migrate(instance, { migrationsFolder })

  db = instance
  return db
}
