import { Db } from './types'

// Services compose repository calls through this instead of touching a Drizzle
// db handle's `.transaction()` API directly.
export function withTransaction<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(fn)
}
