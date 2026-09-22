export type IpcData<T> = T extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; data: infer D }
    ? D
    : never
  : never
