import type { IpcResult } from '../../../shared/ipc'

export const PAGE_SIZE = 50

// Dropdowns/autocompletes (category picker, item picker, username lookups,
// name/unit suggestions) need every row to stay selectable/resolvable, not
// just whatever's on the table's current page - probing the real `total`
// with one page-sized call and, if that didn't cover it, refetching with
// pageSize set to the real total gets the complete list in at most two
// requests, without guessing a "large enough" page size up front.
export async function fetchAllPages<Row, Data extends { total: number }>(
  fetchPage: (pageSize: number) => Promise<IpcResult<Data>>,
  getRows: (data: Data) => Row[]
): Promise<Row[]> {
  const first = await fetchPage(PAGE_SIZE)
  if (!first.ok) return []

  const rows = getRows(first.data)
  if (first.data.total <= rows.length) return rows

  const all = await fetchPage(first.data.total)
  return all.ok ? getRows(all.data) : rows
}
