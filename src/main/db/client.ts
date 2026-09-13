import { app } from 'electron'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

let db: PgliteDatabase<typeof schema> | null = null

export async function getDb(): Promise<PgliteDatabase<typeof schema>> {
  if (db) return db

  const client = new PGlite(join(app.getPath('userData'), 'pgdata'))
  await client.exec("SET TIME ZONE 'UTC'")
  const instance = drizzle(client, { schema })

  await migrate(instance, { migrationsFolder: join(__dirname, 'db/migrations') })

  db = instance
  return db
}
