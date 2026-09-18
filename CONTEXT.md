# Context

## Glossary

### Repository

A module in `src/main/db/repositories/` that owns direct database access for one aggregate (`items`, `categories`, `movements`, `users`). Takes a Drizzle `Db` (or transaction) handle as its first parameter, enforces the invariants that must hold at the data layer (e.g. quantity can't go negative, an item with movement history can't be deleted), and exposes plain async functions — no classes, no DI container.

### Service

A module in `src/main/services/` that sits between repositories and the (future) IPC boundary. A service's public functions are the seam main-process callers use instead of importing repositories directly. Where a service has no cross-repository logic to add, its functions are a thin re-export of the matching repository function with an identical signature. Where a service composes more than one repository — because a business rule spans aggregates and doesn't belong to either repository alone — it does so here, opening a `db.transaction(...)` when the composition needs to be atomic and passing the resulting `tx` handle into the repository calls it wraps.

## Decisions

- Repository → service → IPC is the intended call direction for main-process code. Code outside `src/main/services/` should call services, not repositories, once a service exists for that aggregate. (No IPC handlers exist yet; `src/main/index.ts` still calls `getDb()` directly for startup only.)
- `userId` is passed explicitly into every service/repository function that needs an actor — there is no session or "current user" concept in the main process.
