import { Db } from '../db/types'
import * as session from '../session'
import { IPC_CHANNELS } from '../../shared/ipc'
import { handle } from './handle'

export function registerSessionIpcHandlers(db: Db): void {
  handle(IPC_CHANNELS.session.login, (username: string, password: string) =>
    session.login(db, username, password)
  )
  handle(IPC_CHANNELS.session.logout, async () => session.logout())
  handle(IPC_CHANNELS.session.current, async () => session.getCurrentUser())
}
