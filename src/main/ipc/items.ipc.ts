import { Db } from '../db/types'
import * as itemsService from '../services/items.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

export function registerItemsIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.items.list, (_user, filters?: itemsService.ListItemsFilters) =>
    itemsService.listItems(db, filters)
  )
  protectedHandle(IPC_CHANNELS.items.get, (_user, id: number) => itemsService.getItem(db, id))
  protectedHandle(
    IPC_CHANNELS.items.create,
    (user, input: Omit<Parameters<typeof itemsService.createItem>[1], 'createdBy'>) =>
      itemsService.createItem(db, { ...input, createdBy: user.id })
  )
  protectedHandle(
    IPC_CHANNELS.items.update,
    (_user, id: number, input: Parameters<typeof itemsService.updateItem>[2]) =>
      itemsService.updateItem(db, id, input)
  )
  protectedHandle(IPC_CHANNELS.items.delete, (_user, id: number) => itemsService.deleteItem(db, id))
  protectedHandle(IPC_CHANNELS.items.lowStock, () => itemsService.lowStockItems(db))
}
