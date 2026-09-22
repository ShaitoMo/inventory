# Development Log

A chronological record of the work done on top of the original `electron-vite` +
Drizzle/PGlite scaffold to turn it into a usable desktop inventory app: local
setup, the renderer UI (login + MDI window shell), feature work per window,
UX polish, and the bugs found and fixed along the way.

This log is descriptive, not authoritative — for the current source of truth on
architecture and conventions, see `CLAUDE.md` and `CONTEXT.md`. Nothing here
should be treated as a decision record; genuine architectural decisions belong
in `docs/adr/`.

> **Status of this work**: everything described below exists in the working
> tree but has not been committed. `git status` shows modifications to
> `src/main/index.ts`, `App.tsx`, theming/CSS, and `button.tsx`, plus new files
> under `src/renderer/src/components/`, `src/renderer/src/windows/`,
> `src/renderer/src/layout/`, `src/renderer/src/theme/`, and
> `src/renderer/src/types/`. The last commit on the branch (`6e5d743`) predates
> all of it.

## 1. Local environment setup

- Installed dependencies (`npm install`, which also runs
  `electron-builder install-app-deps` via `postinstall`).
- Ran the seed script to create the first account:
  `npm run db:seed-user -- admin admin123`, matching the CLI-seeding approach
  documented in `CONTEXT.md` (there is deliberately no in-app "first run"
  bootstrap — `users:create` is a protected IPC channel like any other).
- Verified `npm run dev` launches the Electron shell with HMR.
- Established, and used throughout the session, a debug/verification
  methodology for anything not visible to normal use (IPC round-trips, main-
  process input handling, etc.): gate temporary diagnostic code behind
  `process.env['DEBUG_VERIFY']` in `src/main/index.ts`, run it with
  `DEBUG_VERIFY=1 npm run dev`, read the console output, then remove the
  scaffolding completely and confirm with `git diff src/main/index.ts` that
  only the intended permanent change remains, followed by a full
  `npm run typecheck` before handing a clean instance back for manual testing.

## 2. Login screen

Added `src/renderer/src/components/LoginForm.tsx`, calling the existing
`window.api.session.login` / `session.logout` / `session.current` IPC methods
(these were already exposed by the preload layer from the earlier backend
work — no IPC changes were needed). The renderer now gates the rest of the UI
behind an active session instead of loading the scaffold placeholder screen.

## 3. Application shell: sidebar + top bar + MDI window area

Adopted the "universal" desktop-app layout the user asked for after a short
design discussion: a left sidebar for navigation, a top bar, and a content
area that hosts floating, draggable/resizable windows — one per feature
(Items, Categories, Movements, Users) plus a Dashboard, all opened on demand
rather than being separate routed pages. `winbox` (WinBox.js) was chosen as
the windowing library, matching the "manage floating windows like a Mikrotik
router admin panel" reference the user gave.

Key decisions from that discussion (captured because they shaped the
implementation, not because they're formal ADRs):

- Items / Categories / Movements / Users / Dashboard are all windows, opened
  from the sidebar; **no page ever opens more than one instance**.
- Window behavior: minimize-to-taskbar, remember layout across restarts
  (position/size/min/max state persisted), and snap/tile support.
- Dashboard was initially treated as a fixed/default view but was later
  changed, at the user's request, to be a window like the others (its source
  moved from a `layout/` location to `src/renderer/src/windows/` to match).

New/changed files:
- `src/renderer/src/windows/WindowManager.tsx` — owns the WinBox instances,
  persistence, and all viewport/snap math (see bugs below for the
  non-obvious parts of this file).
- `src/renderer/src/windows/{ItemsWindow,CategoriesWindow,MovementsWindow,
  UsersWindow,DashboardWindow}.tsx` — one component per window.
- `src/renderer/src/layout/` — sidebar + top bar shell (`AppShell` and
  related components).
- `src/renderer/src/theme/` — light/dark theme toggle, following Tailwind v4
  `:root` / `:root.dark` token pairs.
- `src/renderer/src/assets/winbox-theme.css` — WinBox skinned to match the
  app's theme instead of its default styling.

### WinBox integration gotcha

`winbox`'s published `package.json` `"browser"` field points at a bundle that
isn't a proper ES module, which produced a white screen on login with no
useful error. Fixed by importing the source file directly
(`winbox/src/js/winbox.js`) and writing a local `.d.ts` for it (the
DefinitelyTyped `@types/winbox` package was removed — it didn't match this
import path).

## 4. Shared UI components

Introduced (via shadcn/ui "new-york" conventions, already scaffolded into the
project by the time this work started — see `components.json`):

- `src/renderer/src/components/ui/combobox.tsx` — a single searchable
  dropdown component used everywhere a `<select>` previously would have been,
  replacing native `<select>`/`<datalist>` elements across every window. It
  has two modes:
  - **Constrained** (must pick an existing option) — shows a "Select…" row
    that acts as a placeholder.
  - **Free text with suggestions** (`freeText` prop) — typed text is used
    directly as the value; no forced "Select…" row.
  All dropdowns that previously used ad hoc markup (category/item pickers,
  unit, username) were migrated onto this one component so they share a
  single visual style.
- `src/renderer/src/components/InfoHint.tsx` + `ui/tooltip.tsx` — a small
  info-icon-plus-tooltip pattern used to explain non-obvious fields per
  window.
- `ui/alert-dialog.tsx` — confirmation dialogs (see §5, edit confirmation).
- `ui/table.tsx` — shared table primitives; row borders were later lightened
  (`border-border/40`) as a polish pass.
- `ui/input.tsx` — placeholder text uses a dimmer color
  (`text-muted-foreground/60`) so placeholders read as *hints*, not as
  pre-filled real values (related to the placeholder-as-input bug below).
- `ui/button.tsx` — added a `destructive-ghost` variant, used for delete
  actions so they read as "dangerous" (red) without the visual weight of a
  solid button.

## 5. Feature work per window

### Items

- Add / edit / delete, list sorted alphabetically by name (A→Z) by default.
- **Quantity is not directly editable**, matching the backend invariant
  described in `CLAUDE.md` (`items.quantity` only changes via
  `stockMovements`) — the edit form omits the quantity field entirely rather
  than disabling it.
- Editing a field that other tables reference by value (e.g. an item's name)
  now goes through a confirmation `AlertDialog` before saving, since the
  rename is understood to cascade to related rows.
- Category and unit pickers use the shared Combobox.
- Delete uses the red `destructive-ghost` button style.
- Per-window refresh button and an `InfoHint` tooltip.

### Categories

- Same edit/confirm/delete/sort/refresh treatment as Items.
- Name field uses the shared Combobox in free-text mode with suggestions.

### Movements

- Explicitly **excluded** from the alphabetical-sort change — movements stay
  sorted newest-first, since recency (not name) is the meaningful order for a
  ledger of stock events.
- The in-app label for the `adjust` movement type was changed from
  "Recount" to **"Adjust"** throughout the UI. This was a UI-only rename —
  the underlying `movementTypeEnum` value (`adjust`), function names
  (`recount` in `movements.repository.ts`), and IPC channel names were
  deliberately left unchanged, so the rename doesn't touch the schema or the
  API surface.
- A related question was raised — recount/adjust currently only supports
  positive quantities; what if the real count is *below* the current
  quantity and needs a negative adjustment? — and was explicitly deferred by
  the user ("forget about it, we'll fix it another time"). **This is an open
  follow-up, not resolved.**

### Users

- Add / edit / delete, alphabetical sort by username.
- Edit form supports changing the username and, optionally, the password:
  the password field is not required when editing
  (`required={!editingId}`), with a placeholder of *"New password (leave
  blank to keep current)"* while editing vs. plain *"Password"* when
  creating. Save always calls `users.update(id, { username })`, then
  conditionally calls `users.changePassword(id, password)` only if a new
  password was entered.
- Username field uses the shared Combobox.

### Cross-cutting form fix

Several add-item forms had a bug where an empty numeric field (e.g. min
quantity) silently submitted using its **placeholder text as if it were the
entered value** (so an empty min-qty field created an item with min qty 10,
matching the placeholder "10"). Fixed by (a) not pre-filling real default
values into fields that should show placeholders only, and (b) validating on
submit that every required field has real user-entered data, not just
placeholder text, before allowing the insert.

## 6. Application menu

Replaced Electron's default menu (File/Edit/View/Window/Help — generic
scaffold items like Undo/Redo, DevTools, a link to electronjs.org) with a
minimal menu specific to this app, built in `src/main/index.ts` via
`Menu.buildFromTemplate`:

- **File**: Reload (`CmdOrCtrl+R`), Close application (`CmdOrCtrl+Q`)
- **View**: Zoom In (`CmdOrCtrl+=`), Zoom Out (`CmdOrCtrl+-`), Full Screen
  (`F11`), Reset to Default (`CmdOrCtrl+0`)

Every item uses Electron's built-in `role` (`reload`, `quit`, `zoomIn`,
`zoomOut`, `togglefullscreen`, `resetZoom`) so the accelerator is wired up
through Electron's native menu/accelerator pipeline rather than being
decorative. The menu bar itself is hidden by default and revealed by tapping
Alt (`autoHideMenuBar: true` on the `BrowserWindow`), per a later request to
keep the UI clean while still leaving the menu discoverable.

## 7. Bugs found and fixed

Several of these were only discoverable by actually driving the UI (dragging
windows to screen edges, minimizing, maximizing, resizing the host window,
pressing real key combinations) rather than by reading the code, and are
recorded here with root cause because the fix isn't obvious from the diff
alone.

### 7.1 White screen on login (WinBox import)

**Symptom**: after logging in, the renderer went blank with no visible error.
**Cause**: `winbox`'s `package.json` `"browser"` field resolves to a bundle
that isn't a valid ES module for this build pipeline.
**Fix**: import `winbox/src/js/winbox.js` directly; hand-write a local
`.d.ts` instead of relying on `@types/winbox`.

### 7.2 Minimized windows reopened minimized

**Symptom**: a window minimized before closing (or before app restart) came
back minimized on next open, instead of restoring to its normal state.
**Cause**: the `onclose` handler never cleared the persisted `min`/`max`
flags for that window.
**Fix**: `onclose` now clears both flags before persisting final state.

### 7.3 Windows could be dragged/resized outside the visible content area

**Symptom**: windows (and their minimized taskbar strip) could end up
partially or fully off-screen.
**Cause**: WinBox always measures its bounds against
`document.documentElement`, **ignoring** any custom `root` element passed to
it — so constraining it by nesting it in a smaller container doesn't work.
A first attempt to fix this with a `contain-layout` CSS rule made things
*worse*: creating a CSS containing block shifted WinBox's internal position
math and double-offset every window.
**Fix**: pass explicit `top`/`left`/`right`/`bottom` inset options to each
WinBox instance, computed from the content area's real screen offset via
`getBoundingClientRect()`. This is the mechanism WinBox actually supports for
confining itself to a sub-region of the screen; the `contain-layout` rule was
removed.

### 7.4 Fullscreen + Esc silently un-minimized windows

**Symptom**: toggling fullscreen and then leaving it (Esc) caused previously
minimized windows to visually pop back to full size.
**Cause**: the host-resize handler recalculated every window's proportional
size using `winbox.width`/`winbox.height`, but WinBox's own `minimize()` /
`maximize()` internally call `.resize()`/`.move()` with `_skip_update: true`
— meaning those properties stay stale (by design, so `.restore()` knows what
to return to) while a window is minimized. The resize handler was
unknowingly using that stale data to actively resize a window that was
supposed to be staying minimized.
**Fix**: the resize handler now skips any window with `winbox.min` set.

### 7.5 Data-loss incident during Edit-feature testing (Items/Categories)

While testing the newly-added Edit feature via a scripted DOM interaction,
the test helper matched **the first "Edit" button anywhere in the window**
rather than the row belonging to the throwaway test data just created — a
consequence of `listItems`/`listCategories` having no explicit `ORDER BY` at
the time. This caused two real, pre-existing rows to be affected:

- A real category (id `1`) was renamed to a test string.
- A real item ("shabak") was renamed and then **permanently deleted** by the
  test's own cleanup step, using the same unscoped matching. This deletion
  is unrecoverable.

This was caught immediately; the four other real items were confirmed
untouched via direct, read-only `window.api` calls, and only the two
unambiguous test-created rows were removed (by exact id, not DOM matching).
The user was given a full disclosure of exactly what happened; they restored
the category name themselves and did not ask for the deleted item to be
re-created.

**Process change made as a result**: all test setup/cleanup from this point
on goes through `window.api` by exact row id, and any DOM interaction in a
test is scoped to the specific row located by its unique test-data text —
never "first match in the window."

### 7.6 `Ctrl+-` (Zoom Out) accelerator silently did nothing

**Symptom**: the custom View → Zoom Out menu item and its `Ctrl+-`
accelerator were configured correctly (confirmed by reading the built menu),
but pressing the real key combination — or simulating it — produced no zoom
change.
**First (incorrect) hypothesis**: that `webContents.sendInputEvent()`, used
to simulate the keypress for verification, doesn't feed into Electron's real
accelerator pipeline. This was stated to the user with too much confidence
before it was actually confirmed, and turned out to be wrong.
**Actual cause**: `@electron-toolkit/utils`'s `optimizer.watchWindowShortcuts(
window)` helper — already present in the scaffold, unrelated to the new
custom menu — installs its own `before-input-event` listener that calls
`event.preventDefault()` on `Ctrl+Minus` and `Ctrl+Shift+Equal` **unless**
it's called with `{ zoom: true }`. It was swallowing the key event before
Electron's menu accelerator ever saw it.
**Fix**: `src/main/index.ts` now calls
`optimizer.watchWindowShortcuts(window, { zoom: true })`, with a comment
explaining why the option is required. Verified by simulating the keypress
and confirming the window's actual zoom level changed
(`zoomBefore: 0` → `zoomAfter: -0.5`), then re-confirmed with a real keypress.

## 8. UX polish pass (smaller items)

- Delete buttons across all tables use the red `destructive-ghost` style.
- Table borders lightened for a less heavy grid look.
- All confirmation-dialog "Cancel" buttons renamed to **"Keep editing"** for
  clarity on what declining the action actually does.
- Add-item "Piece" unit placeholder capitalized.
- Add-item name field placeholder set to "Item name".
- Spacing fix on the `AppShell` placeholder/empty-state text.

## 9. Known open items / deferred work

- **Negative stock adjustments**: the "Adjust" movement type currently only
  accepts a positive quantity; supporting a downward adjustment (real count
  below system count) was raised and explicitly deferred, not designed or
  implemented.
- **Nothing in this log has been committed.** `git log` still ends at
  `6e5d743` ("Add session/auth enforcement and wire services to IPC"); all
  renderer/UI work described above is uncommitted working-tree state.
