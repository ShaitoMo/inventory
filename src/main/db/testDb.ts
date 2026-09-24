import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema'

export async function createTestDb(): Promise<PgliteDatabase<typeof schema> & { $client: PGlite }> {
  const client = new PGlite()
  await client.exec("SET TIME ZONE 'UTC'")
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') })
  return db
}
