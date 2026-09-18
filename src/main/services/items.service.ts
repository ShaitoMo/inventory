import { Db } from '../db/types'
import { withTransaction } from '../db/transaction'
import * as itemsRepository from '../db/repositories/items.repository'
import { getCategory } from './categories.service'
import { NotFoundError, toServiceError } from './errors'

export type { ListItemsFilters } from '../db/repositories/items.repository'

export async function listItems(
  db: Db,
  filters?: itemsRepository.ListItemsFilters
): ReturnType<typeof itemsRepository.listItems> {
  try {
    return await itemsRepository.listItems(db, filters)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function getItem(db: Db, id: number): ReturnType<typeof itemsRepository.getItem> {
  try {
    return await itemsRepository.getItem(db, id)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function updateItem(
  db: Db,
  id: number,
  input: Parameters<typeof itemsRepository.updateItem>[2]
): ReturnType<typeof itemsRepository.updateItem> {
  try {
    const item = await itemsRepository.updateItem(db, id, input)
    if (!item) {
      throw new NotFoundError('Item not found')
    }
    return item
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function deleteItem(db: Db, id: number): Promise<void> {
  try {
    const deleted = await itemsRepository.deleteItem(db, id)
    if (!deleted) {
      throw new NotFoundError('Item not found')
    }
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function lowStockItems(db: Db): ReturnType<typeof itemsRepository.lowStockItems> {
  try {
    return await itemsRepository.lowStockItems(db)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function createItem(
  db: Db,
  input: Parameters<typeof itemsRepository.createItem>[1]
): ReturnType<typeof itemsRepository.createItem> {
  try {
    return await withTransaction(db, async (tx) => {
      const category = await getCategory(tx, input.categoryId)
      if (!category) {
        throw new NotFoundError('Category not found')
      }

      return itemsRepository.createItem(tx, input)
    })
  } catch (error) {
    throw toServiceError(error)
  }
}
