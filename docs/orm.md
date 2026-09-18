# ORM (Drizzle)

Schema lives at `src/main/db/schema.ts`. Data is a local embedded Postgres (PGlite/WASM) — no external DB server.

## Generate a migration

After editing `schema.ts`:

```bash
npx drizzle-kit generate
```

Writes SQL to `src/main/db/migrations/`. Don't hand-edit generated files or `meta/`. Migrations run automatically on app startup (`getDb()` in `src/main/db/client.ts`).

## Open Drizzle Studio

Browses/edits the **real app's** database (the one under Electron's `userData`, e.g. `%APPDATA%\inventory\pgdata` on Windows):

```bash
npx drizzle-kit studio --config drizzle.studio.config.ts
```

Opens a browser UI at `local.drizzle.studio`. Close the running app first — PGlite doesn't support concurrent connections from two processes.

## Test databases

Repository/service tests never touch the real DB — `createTestDb()` (`src/main/db/testDb.ts`) spins up a fresh in-memory PGlite per test, migrated the same way. Studio can't inspect these (they don't persist to disk).
