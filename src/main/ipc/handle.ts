import { ipcMain } from 'electron'
import type { IpcResult } from '../../shared/ipc'
import { requireCurrentUser } from '../session'
import { logError } from '../logger'

export function handle<Args extends unknown[], R>(
  channel: string,
  fn: (...args: Args) => Promise<R>
): void {
  ipcMain.handle(channel, async (_event, ...args: Args): Promise<IpcResult<R>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      // The renderer only gets `name`/`message` (see IpcResult) - that's
      // often a trimmed or generic string (e.g. drizzle's
      // `DrizzleQueryError` message omits the actual Postgres reason, which
      // lives on `.cause`). Logging the full `err` here, not just the
      // message, is what makes that reason recoverable after the fact.
      await logError(`IPC "${channel}" failed`, err)
      return { ok: false, error: { name: err.name, message: err.message } }
    }
  })
}

// Like `handle`, but requires an active session first and passes the
// current user into the handler — the actor for a mutation comes from the
// session, never from whatever the renderer's payload claims.
export function protectedHandle<Args extends unknown[], R>(
  channel: string,
  fn: (user: ReturnType<typeof requireCurrentUser>, ...args: Args) => Promise<R>
): void {
  handle(channel, (...args: Args) => fn(requireCurrentUser(), ...args))
}
