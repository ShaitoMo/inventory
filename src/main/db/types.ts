import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'

export type Db = PgliteDatabase<typeof schema>
