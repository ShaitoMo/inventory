import { Db } from '../db/types'
import * as categoriesService from '../services/categories.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'

export function registerCategoriesIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.categories.list, () => categoriesService.listCategories(db))
  protectedHandle(IPC_CHANNELS.categories.get, (_user, id: number) =>
    categoriesService.getCategory(db, id)
  )
  protectedHandle(
    IPC_CHANNELS.categories.create,
    (_user, input: Parameters<typeof categoriesService.createCategory>[1]) =>
      categoriesService.createCategory(db, input)
  )
  protectedHandle(
    IPC_CHANNELS.categories.update,
    (_user, id: number, input: Parameters<typeof categoriesService.updateCategory>[2]) =>
      categoriesService.updateCategory(db, id, input)
  )
  protectedHandle(IPC_CHANNELS.categories.delete, (_user, id: number) =>
    categoriesService.deleteCategory(db, id)
  )
}
