import { Db } from '../db/types'
import * as movementsService from '../services/movements.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

export function registerMovementsIpcHandlers(db: Db): void {
  protectedHandle(
    IPC_CHANNELS.movements.create,
    (user, input: Omit<Parameters<typeof movementsService.createMovement>[1], 'userId'>) =>
      movementsService.createMovement(db, { ...input, userId: user.id })
  )
  protectedHandle(IPC_CHANNELS.movements.listByItem, (_user, itemId: number) =>
    movementsService.listMovementsByItem(db, itemId)
  )
  protectedHandle(
    IPC_CHANNELS.movements.list,
    (_user, filters?: movementsService.ListMovementsFilters) =>
      movementsService.listMovements(db, filters)
  )
  protectedHandle(
    IPC_CHANNELS.movements.recount,
    (user, input: Omit<Parameters<typeof movementsService.recount>[1], 'userId'>) =>
      movementsService.recount(db, { ...input, userId: user.id })
  )
}
