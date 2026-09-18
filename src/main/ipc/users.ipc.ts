import { Db } from '../db/types'
import * as usersService from '../services/users.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

export function registerUsersIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.users.list, () => usersService.listUsers(db))
  protectedHandle(
    IPC_CHANNELS.users.create,
    (_user, input: Parameters<typeof usersService.createUser>[1]) =>
      usersService.createUser(db, input)
  )
  protectedHandle(
    IPC_CHANNELS.users.update,
    (_user, id: number, input: Parameters<typeof usersService.updateUser>[2]) =>
      usersService.updateUser(db, id, input)
  )
  protectedHandle(IPC_CHANNELS.users.changePassword, (_user, id: number, newPassword: string) =>
    usersService.changePassword(db, id, newPassword)
  )
  protectedHandle(IPC_CHANNELS.users.delete, (_user, id: number) => usersService.deleteUser(db, id))
}
