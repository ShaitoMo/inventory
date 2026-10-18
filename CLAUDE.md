# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Electron + React + TypeScript desktop inventory app ("ventrack"). Data lives in an embedded Postgres (PGlite, WASM) that runs inside the Electron main process — there is no external database server or network backend. The main process is the only thing that ever touches the database; the renderer talks to it over a typed Electron IPC bridge.

The `src/main/db` layer (schema, migrations, repositories, tests), a `src/main/services` layer on top of it, and a full IPC surface (`src/main/ipc`, `src/preload`, `src/shared/ipc.ts`) are all built out, and the renderer is a real multi-window UI (see Architecture below).

## Commands

```bash
npm install               # install deps (also runs electron-builder install-app-deps via postinstall)
npm run dev                # electron-vite dev, with HMR
npm run start               # build preview (electron-vite preview)

npm run lint                # eslint --cache .
npm run format               # prettier --write .

npm run typecheck            # both projects below
npm run typecheck:node        # tsc --noEmit -p tsconfig.node.json (main + preload)
npm run typecheck:web         # tsc --noEmit -p tsconfig.web.json (renderer)

npm test                     # vitest run (only src/main/**/*.test.ts is collected)
npx vitest run src/main/db/repositories/items.repository.test.ts   # single file
npx vitest run -t "rejects an \"out\" movement"                     # by test name

npm run build                 # typecheck + electron-vite build
npm run build:win / :mac / :linux   # full electron-builder package for a platform

npx drizzle-kit generate       # generate a new SQL migration after editing src/main/db/schema.ts
```

There is no watch mode wired for tests; `npm test` runs once. Vitest's `testTimeout` is set to 20s in `vitest.config.ts` because spinning up a fresh PGlite instance per test is slow.

## Architecture

### Process split

Standard `electron-vite` three-target layout, each with its own tsconfig:
- `src/main` — Node/Electron process. Owns the database entirely. Typechecked via `tsconfig.node.json`.
- `src/preload` — context-bridge script. `src/preload/api.ts` builds the real `api` object (one namespace per aggregate: `items`, `categories`, `movements`, `users`, `session`, `settings`, `backup`, `reports`), each method calling `ipcRenderer.invoke` on a channel from `src/shared/ipc.ts` and typed off the matching main-process service's signature/return type via `Parameters`/`ReturnType`. `src/preload/index.ts` exposes it (plus `@electron-toolkit/preload`'s `electronAPI`) through `contextBridge`; `src/preload/index.d.ts` declares `Window.api: Api`.
- `src/renderer/src` — React UI, aliased as `@renderer/*`. Typechecked via `tsconfig.web.json`. No database or business logic should live here — everything goes through `window.api.*`. A `WindowManager`/`registry` (winbox-based) opens per-feature windows: `Dashboard`, `ItemsWindow`, `CategoriesWindow`, `MovementsWindow`, `ReportsWindow`, `UsersWindow`, `SettingsWindow`, plus `LoginForm` and shared `components/ui/*`.

### IPC layer (`src/main/ipc`, `src/preload`, `src/shared/ipc.ts`)

- **`src/shared/ipc.ts`** — the only place channel name strings live (`IPC_CHANNELS`, grouped by aggregate) and the `IpcResult<T>` envelope every handled channel resolves to: `{ ok: true; data: T } | { ok: false; error: { name; message } }`. A failed call never rejects the promise — callers must check `ok` before reading `data`.
- **`src/main/ipc/handle.ts`** — `handle(channel, fn)` wraps `ipcMain.handle` and catches/normalizes into `IpcResult`. `protectedHandle(channel, fn)` wraps `handle` and additionally calls `requireCurrentUser()` first, passing the current user in as the handler's first argument; the actor for a mutation always comes from the session, never from the renderer's payload. Every channel is registered through one of these two, one `*.ipc.ts` file per aggregate (`items.ipc.ts`, `categories.ipc.ts`, `movements.ipc.ts`, `users.ipc.ts`, `settings.ipc.ts`, `reports.ipc.ts`) plus `session.ipc.ts`. The only unprotected channels are `session:login`, `session:logout`, and `session:current`. `src/main/index.ts` calls each `register*IpcHandlers(db)` once, after the db is open, before `createWindow()`.
- Fields like `userId`/`createdBy` are stripped from the renderer-facing input type (via `Omit<...>`) for `items:create`, `movements:create`, and `movements:recount`, and injected server-side from the session user inside the IPC handler — see `items.ipc.ts`'s `items.create` handler for the pattern.
- **Adding a new IPC-exposed operation**: add the channel to `IPC_CHANNELS`, add a handler in the aggregate's `*.ipc.ts` (via `protectedHandle` unless it must be reachable pre-login), add a method to `src/preload/api.ts` that calls `invoke` with that channel and infers its types off the service function, and it's automatically visible on `window.api` per `index.d.ts`'s `Api` type — no separate renderer-side typing to maintain. Don't reach into `src/main/db` or `src/main/services` from renderer code — it's a different process and won't even bundle correctly.

### Services layer (`src/main/services`)

Sits between repositories and IPC handlers; see `CONTEXT.md`'s glossary for the canonical definition. One file per aggregate (`items`, `categories`, `movements`, `users`, `reports`, plus `backup`), each with a `*.service.test.ts` (`reports` also has `reports.export.test.ts` for its Excel export). A service function takes the same `(db, ...)` shape as its repository counterpart and is a thin re-export where there's no cross-repository logic to add (e.g. `getItem`, `listItems` in `items.service.ts` just forward to the repository inside a `try/catch`). Where a business rule spans aggregates — e.g. `createItem` needs to check the category exists before inserting — the service opens `withTransaction(db, ...)` (`src/main/db/transaction.ts`) and passes the resulting `tx` into both repository calls, so the composition is atomic.

`src/main/services/errors.ts` defines `NotFoundError`, `ValidationError`, `UnauthorizedError`, and `toServiceError`, which maps a repository's plain `Error` (matched by a fixed message set) onto one of those types. Every service function funnels caught errors through `toServiceError` so callers — ultimately IPC handlers — can branch on error type/name instead of matching message strings. Repository → service → IPC is the intended call direction for main-process code; call services, not repositories, once a service exists for an aggregate.

### Session (`src/main/session.ts`)

An in-memory, single-process record of the currently logged-in user (`login`/`logout`/`getCurrentUser`/`requireCurrentUser`) — no persistence across restarts. `login` calls `authenticateUser` from `users.service.ts` and throws `UnauthorizedError` on bad credentials. `requireCurrentUser` (used by `protectedHandle`) throws `UnauthorizedError` if nobody is logged in.

### Bootstrapping an admin account

There's no unauthenticated IPC path to create a user — `users:create` is `protectedHandle`-guarded like everything else. Accounts are created outside IPC, via `src/main/seedUser.ts`, reachable two ways: `npm run db:seed-user -- <username> <password>` (dev, `src/main/seed.ts`) or `<installed exe> --seed-user <username> <password>` (packaged, parsed in `src/main/index.ts`). Additionally, `index.ts` auto-seeds one `admin`/`admin123` account on startup *only* when `users` is genuinely empty (first launch after a fresh install) — a packaged build has no terminal to run the CLI flag from. Change that password via the Users window after first login.

### Database layer (`src/main/db`)

- **`schema.ts`** — Drizzle schema, single source of truth for tables: `users`, `categories`, `items`, `stockMovements` (+ `movementTypeEnum`: `in` | `out` | `adjust`). A check constraint enforces movement quantity at the DB level (`in`/`out` > 0, `adjust` ≠ 0). `items.quantity` itself has no non-negative constraint (dropped in migration `0002`) and can go negative.
- **`client.ts`** — `getDb()` is a lazily-initialized singleton used by the running app. It opens PGlite against a file under `app.getPath('userData')/pgdata` and runs pending migrations on first call via `drizzle-orm/pglite/migrator`. Every main-process caller should go through this one instance, not construct its own `PGlite`/`drizzle` client.
- **`testDb.ts`** — `createTestDb()` spins up an **in-memory** PGlite (no path given) and runs the same migrations. Every repository test calls this to get an isolated, throwaway database — tests never share state or hit disk.
- **`testFixtures.ts`** — small seed helpers (`seedCategory`, `seedUser`) built on top of the repositories themselves, not raw inserts.
- **`migrations/`** — generated by `drizzle-kit` (`drizzle.config.ts`: `dialect: 'postgresql'`, schema `./src/main/db/schema.ts`). Regenerate with `npx drizzle-kit generate` after any schema change; do not hand-edit generated SQL or the `meta/` snapshot files.
- **`repositories/`** — one file per aggregate (`items`, `categories`, `movements`, `users`, plus the read-only `reports`), each exporting plain async functions that take the Drizzle db instance as their first argument (no classes/DI container). This is the pattern to follow for new repositories.

Business rule to preserve: **`items.quantity` is derived, not directly editable.** It only changes as a side effect of writing a row to `stockMovements` (see `movements.repository.ts` — `createMovement` and `recount`), enforced further by the DB check constraint. `updateItem` intentionally only touches descriptive fields (name, category, unit, minQty), never quantity. Deleting an item is blocked (`deleteItem`) if it has any movement history.

Monthly report (`reports.repository.ts`, `ReportsWindow`): a read-only, per-category, per-item summary of one calendar month — opening / in / out / adjust / closing. Balances are never stored historically, so they are derived backwards from the current `items.quantity`: `closing = current − net(movements since month end)`, `opening = closing − net(month)`, where net counts `out` as negative and `adjust` as its signed delta. The month is a half-open window in the machine's **local** time (matching the dates the Movements window shows) while `created_at` is stored as UTC `timestamp`, so bounds are passed as `Date`s through Drizzle's column encoders rather than using `date_trunc`. The Excel export reuses `addSheet`/`backupTimestamp` from `backup.service.ts` and writes to the configured **reports** folder — a separate setting from the backup folder (`AppSettings.reportsFolder` in `src/main/settings.ts`, default `Public\Documents\Ventrack Reports` on Windows, chosen in Settings). Each feature that writes files gets its own folder setting; saves go through `updateSettings`, which merges into the existing file so changing one folder never drops another, and a `settings.json` written before a setting existed falls back to that setting's default. Both `monthly` and `exportMonthly` accept `onlyWithMovements` (a `HAVING count(movements in month) > 0`, so a +5/−5 recount pair still counts as moved); the window's "Show items with no movements" checkbox sets it for the on-screen report, while Export prompts for the choice independently of the checkbox.

`users.repository.ts` hashes passwords with Node's `crypto.scrypt` (salt:hash hex format) and never returns `passwordHash` from any query — selects explicitly project a `userSelection` column list that omits it.

### Testing conventions

Repository tests live next to their repository as `*.repository.test.ts` and follow the same shape: `createTestDb()` → seed via `testFixtures`/other repository calls → exercise the function under test → assert both the return value and, where relevant, the resulting row state (e.g. re-reading `items.quantity` after a movement). Prefer this over asserting against mocked query builders.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
