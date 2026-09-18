# Services layer for the repositories

Status: ready-for-agent

## Problem Statement

Business logic today lives only in the repository layer (`src/main/db/repositories/`), with nothing above it. There's no place to put logic that spans more than one repository (e.g. validating a referenced category exists before creating an item), and nothing for a future IPC handler to call that isn't itself a raw repository function reaching into the database layer from the wrong process boundary.

## Solution

Introduce a `src/main/services/` directory with one service module per existing repository (`items`, `categories`, `movements`, `users`). Each service re-exports the repository's operations as its public API today; where a concrete cross-repository need exists, the service composes multiple repositories, using a Drizzle transaction when the composition must be atomic. This creates a stable seam that future IPC handlers and future orchestration logic both build on, without inventing orchestration that has no current caller.

## User Stories

1. As a main-process caller (currently `src/main/index.ts`, eventually an IPC handler), I want a single `itemsService` module to call for all item operations, so that I never import from `db/repositories` directly outside the services layer.
2. As a main-process caller, I want the same for `categoriesService`, `movementsService`, and `usersService`.
3. As a developer creating an item, I want `itemsService.createItem` to validate that the referenced `categoryId` actually exists and return a clear domain error (`Category not found`) if not, so that I get an intelligible error instead of a raw Postgres foreign-key violation.
4. As a developer, I want that category-existence check and the item insert to happen atomically (single transaction) so a category deleted concurrently between the check and the insert can't produce an inconsistent write.
5. As a developer writing main-process code, I want every other service function (list/get/update/delete on items, categories, movements, users) to behave identically to calling the underlying repository function directly, so migrating existing call sites to the service layer is a safe, mechanical change.
6. As a developer, I want `movementsService.createMovement` and `movementsService.recount` to validate that the referenced `itemId` exists before delegating — the repository already does this internally — so I don't need this restated as a plain pass-through; the service simply delegates and returns/throws whatever the repository does.
7. As a maintainer, I want the services layer's role documented in `CONTEXT.md` (created lazily, since none exists yet) so future contributors know the repository/service/IPC boundary and don't reintroduce direct repository calls from outside `src/main`.
8. As a maintainer, I want service functions typed identically to their repository counterparts (same input/output shapes) wherever no additional validation is added, so there's no silent behavior drift between the two layers.

## Implementation Decisions

- New directory `src/main/services/`, one file per aggregate: `items.service.ts`, `categories.service.ts`, `movements.service.ts`, `users.service.ts`.
- Each service function takes the same `Db` first-parameter convention as repositories (so a service function can itself be called with a `tx` handle if a future caller needs to compose it into a larger transaction).
- `categoriesService`, `movementsService`, `usersService`: thin delegation — each exported function signature matches its repository counterpart exactly and simply calls through. No new tests needed for pure delegation (per Testing Decisions).
- `itemsService.createItem`: the one function with real orchestration. Wraps the operation in `db.transaction(async (tx) => { ... })`: reads the category via `categoriesRepository` (no existing single-category getter — add `getCategory(db, id)` to `categories.repository.ts` if one doesn't already exist, matching the existing repo style), throws `Category not found` if absent, then delegates to `itemsRepository.createItem(tx, input)`. All other `itemsService` functions are thin delegation like the other three services.
- No IPC handler, preload, or renderer changes in this spec.
- No session/auth state introduced; `userId` remains an explicit argument threaded through from the caller.
- `CONTEXT.md` gets created (it doesn't exist yet) with entries for: **Repository** (existing convention, now formalized in contrast to Service), **Service** (the new layer — orchestration + validation above repositories, the boundary IPC handlers will call), and the repository/service/IPC layering rule itself.

## Testing Decisions

- Good test = exercises only the service's public function signature, asserts on return value and (where relevant) resulting DB row state — never reaches into repository internals or asserts against mocked query builders. Matches the existing convention in `*.repository.test.ts` (`createTestDb()` → seed via `testFixtures` → exercise → assert).
- Only `itemsService.createItem` gets a dedicated `items.service.test.ts`, covering:
  - creating an item with a valid `categoryId` succeeds and matches repository behavior for a direct call.
  - creating an item with a nonexistent `categoryId` throws `Category not found` and does not insert a row.
- `categoriesService`, `movementsService`, `usersService`, and the rest of `itemsService` are pure delegation and get no new tests — the existing repository tests already cover that behavior; duplicating them at the service layer would be tautological (same fixtures, same assertions, no new logic under test).
- Prior art: `src/main/db/repositories/items.repository.test.ts` and `movements.repository.test.ts` for the `createTestDb()` + `testFixtures` pattern.

## Out of Scope

- IPC handler wiring (`ipcMain.handle`), preload `api` surface, typed `Window.api` — separate follow-up spec.
- Session/auth/current-user concept — `userId` stays explicit.
- Any other cross-aggregate orchestration beyond the category-existence check on item creation — not introduced speculatively; add when a real caller needs it.
- Changing repository function signatures or business rules — repositories are unchanged except for the addition of `categories.repository.ts#getCategory` if it doesn't already exist.

## Further Notes

- `CONTEXT.md` should be created as part of implementing this spec (not before), per the domain-modeling skill's "create lazily" rule — the first real terms to resolve are **Repository**/**Service** from this work.
- Test seam confirmed with the user: the exported service functions themselves (called directly against `createTestDb()`), matching the existing repository test convention — no IPC/Electron boundary involved.

## Comments
