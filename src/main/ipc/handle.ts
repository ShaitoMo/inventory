import { ipcMain } from 'electron'
import type { IpcResult } from '../../shared/ipc'
import { requireCurrentUser } from '../session'

export function handle<Args extends unknown[], R>(
  channel: string,
  fn: (...args: Args) => Promise<R>
): void {
  ipcMain.handle(channel, async (_event, ...args: Args): Promise<IpcResult<R>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
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
