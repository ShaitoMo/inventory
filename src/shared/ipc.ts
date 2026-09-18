// Every IPC call resolves (never rejects) to this. Callers must check `ok`
// before reading `data` — a failed call is not a thrown/rejected promise.
export type IpcResult<T> =
  { ok: true; data: T } | { ok: false; error: { name: string; message: string } }

export const IPC_CHANNELS = {
  items: {
    list: 'items:list',
    get: 'items:get',
    create: 'items:create',
    update: 'items:update',
    delete: 'items:delete',
    lowStock: 'items:lowStock'
  },
  categories: {
    list: 'categories:list',
    get: 'categories:get',
    create: 'categories:create',
    update: 'categories:update',
    delete: 'categories:delete'
  },
  movements: {
    create: 'movements:create',
    listByItem: 'movements:listByItem',
    list: 'movements:list',
    recount: 'movements:recount'
  },
  users: {
    list: 'users:list',
    create: 'users:create',
    update: 'users:update',
    changePassword: 'users:changePassword',
    delete: 'users:delete'
  },
  session: {
    login: 'session:login',
    logout: 'session:logout',
    current: 'session:current'
  }
} as const
