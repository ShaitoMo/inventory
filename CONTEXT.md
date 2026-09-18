# Context

## Glossary

### Repository

A module in `src/main/db/repositories/` that owns direct database access for one aggregate (`items`, `categories`, `movements`, `users`). Takes a Drizzle `Db` (or transaction) handle as its first parameter, enforces the invariants that must hold at the data layer (e.g. quantity can't go negative, an item with movement history can't be deleted), and exposes plain async functions — no classes, no DI container.

### Service

A module in `src/main/services/` that sits between repositories and the IPC boundary. A service's public functions are the seam main-process callers use instead of importing repositories directly. Where a service has no cross-repository logic to add, its functions are a thin re-export of the matching repository function with an identical signature. Where a service composes more than one repository — because a business rule spans aggregates and doesn't belong to either repository alone — it does so here, opening a `db.transaction(...)` when the composition needs to be atomic and passing the resulting `tx` handle into the repository calls it wraps.

### Session

`src/main/session.ts` — an in-memory, single-process record of the currently logged-in user (`login`/`logout`/`getCurrentUser`/`requireCurrentUser`). Lives only for the life of the running app; there is no persistence across restarts. It is the source of truth for "who is acting" — IPC handlers derive the actor id from it rather than trusting whatever a mutation's payload claims.

## Decisions

- Repository → service → IPC is the intended call direction for main-process code. Code outside `src/main/services/` should call services, not repositories, once a service exists for that aggregate.
- IPC handlers (`src/main/ipc/*.ipc.ts`) wrap their service calls via `protectedHandle` (`src/main/ipc/handle.ts`), which requires an active session and rejects with `UnauthorizedError` otherwise — this is enforced server-side, not just a renderer-side gate. The only unprotected channels are `session:login`, `session:logout`, and `session:current` (how you get a session in the first place).
- `userId`/`createdBy` are no longer accepted from the renderer for `items:create`, `movements:create`, or `movements:recount` — the IPC layer drops that field from the payload and injects the session's actual user id. Service functions still take `userId` as an explicit parameter (unchanged), it's just sourced from the session now instead of blindly trusting the caller.
- There is no unauthenticated bootstrap path in the running app — `users:create` is protected like every other channel. Accounts (including the first one) are created via a standalone CLI script (`npm run db:seed-user -- <username> <password>`, built from `src/main/seed.ts`) that talks to the database directly, bypassing IPC/session entirely. The script has no "only if empty" guard — it's a general admin tool for creating a user from the CLI, not a one-time-only gate.
