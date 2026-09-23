import { getDb } from './db/client'
import { createUser } from './services/users.service'

// Shared by the dev-only `npm run db:seed-user` entry (seed.ts) and by
// index.ts's `--seed-user` CLI flag, which is the only way to provision an
// account once the app is packaged — there is no in-app account bootstrap
// (see CONTEXT.md: users:create is a protected IPC channel like any other).
//
// `migrationsDir` is passed in rather than derived from this file's own
// `__dirname`: this module ends up bundled into a shared chunk under
// `out/main/chunks/`, not `out/main/` itself, so its own `__dirname` doesn't
// point at the right place. Callers (always a top-level entry file sitting
// directly in `out/main/`) compute it correctly instead.
export async function seedUser(
  migrationsDir: string,
  username: string,
  password: string
): Promise<void> {
  const db = await getDb(migrationsDir)
  const user = await createUser(db, { username, password })
  console.log('Created user:', user)
}
