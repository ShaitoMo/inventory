import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../db/schema'
import { getCategory } from '../db/repositories/categories.repository'
import * as itemsRepository from '../db/repositories/items.repository'

export type { ListItemsFilters } from '../db/repositories/items.repository'

type Db = PgliteDatabase<typeof schema>

export const listItems = itemsRepository.listItems
export const getItem = itemsRepository.getItem
export const updateItem = itemsRepository.updateItem
export const deleteItem = itemsRepository.deleteItem
export const lowStockItems = itemsRepository.lowStockItems

export async function createItem(
  db: Db,
  input: {
    name: string
    categoryId: number
    createdBy: number
    unit?: string
    minQty?: number
  }
): ReturnType<typeof itemsRepository.createItem> {
  return db.transaction(async (tx) => {
    const category = await getCategory(tx, input.categoryId)
    if (!category) {
      throw new Error('Category not found')
    }

    return itemsRepository.createItem(tx, input)
  })
}
