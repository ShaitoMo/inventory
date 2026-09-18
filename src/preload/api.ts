import { ipcRenderer } from 'electron'
import { IPC_CHANNELS, IpcResult } from '../shared/ipc'
import type * as itemsService from '../main/services/items.service'
import type * as categoriesService from '../main/services/categories.service'
import type * as movementsService from '../main/services/movements.service'
import type * as usersService from '../main/services/users.service'
import type * as session from '../main/session'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

export const api = {
  items: {
    list: (filters?: itemsService.ListItemsFilters) =>
      invoke<Awaited<ReturnType<typeof itemsService.listItems>>>(IPC_CHANNELS.items.list, filters),
    get: (id: number) =>
      invoke<Awaited<ReturnType<typeof itemsService.getItem>>>(IPC_CHANNELS.items.get, id),
    create: (input: Omit<Parameters<typeof itemsService.createItem>[1], 'createdBy'>) =>
      invoke<Awaited<ReturnType<typeof itemsService.createItem>>>(IPC_CHANNELS.items.create, input),
    update: (id: number, input: Parameters<typeof itemsService.updateItem>[2]) =>
      invoke<Awaited<ReturnType<typeof itemsService.updateItem>>>(
        IPC_CHANNELS.items.update,
        id,
        input
      ),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.items.delete, id),
    lowStock: () =>
      invoke<Awaited<ReturnType<typeof itemsService.lowStockItems>>>(IPC_CHANNELS.items.lowStock)
  },
  categories: {
    list: () =>
      invoke<Awaited<ReturnType<typeof categoriesService.listCategories>>>(
        IPC_CHANNELS.categories.list
      ),
    get: (id: number) =>
      invoke<Awaited<ReturnType<typeof categoriesService.getCategory>>>(
        IPC_CHANNELS.categories.get,
        id
      ),
    create: (input: Parameters<typeof categoriesService.createCategory>[1]) =>
      invoke<Awaited<ReturnType<typeof categoriesService.createCategory>>>(
        IPC_CHANNELS.categories.create,
        input
      ),
    update: (id: number, input: Parameters<typeof categoriesService.updateCategory>[2]) =>
      invoke<Awaited<ReturnType<typeof categoriesService.updateCategory>>>(
        IPC_CHANNELS.categories.update,
        id,
        input
      ),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.categories.delete, id)
  },
  movements: {
    create: (input: Omit<Parameters<typeof movementsService.createMovement>[1], 'userId'>) =>
      invoke<Awaited<ReturnType<typeof movementsService.createMovement>>>(
        IPC_CHANNELS.movements.create,
        input
      ),
    listByItem: (itemId: number) =>
      invoke<Awaited<ReturnType<typeof movementsService.listMovementsByItem>>>(
        IPC_CHANNELS.movements.listByItem,
        itemId
      ),
    list: (filters?: movementsService.ListMovementsFilters) =>
      invoke<Awaited<ReturnType<typeof movementsService.listMovements>>>(
        IPC_CHANNELS.movements.list,
        filters
      ),
    recount: (input: Omit<Parameters<typeof movementsService.recount>[1], 'userId'>) =>
      invoke<Awaited<ReturnType<typeof movementsService.recount>>>(
        IPC_CHANNELS.movements.recount,
        input
      )
  },
  users: {
    list: () => invoke<Awaited<ReturnType<typeof usersService.listUsers>>>(IPC_CHANNELS.users.list),
    create: (input: Parameters<typeof usersService.createUser>[1]) =>
      invoke<Awaited<ReturnType<typeof usersService.createUser>>>(IPC_CHANNELS.users.create, input),
    update: (id: number, input: Parameters<typeof usersService.updateUser>[2]) =>
      invoke<Awaited<ReturnType<typeof usersService.updateUser>>>(
        IPC_CHANNELS.users.update,
        id,
        input
      ),
    changePassword: (id: number, newPassword: string) =>
      invoke<void>(IPC_CHANNELS.users.changePassword, id, newPassword),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.users.delete, id)
  },
  session: {
    login: (username: string, password: string) =>
      invoke<Awaited<ReturnType<typeof session.login>>>(
        IPC_CHANNELS.session.login,
        username,
        password
      ),
    logout: () => invoke<void>(IPC_CHANNELS.session.logout),
    current: () =>
      invoke<Awaited<ReturnType<typeof session.getCurrentUser>>>(IPC_CHANNELS.session.current)
  }
}

export type Api = typeof api
