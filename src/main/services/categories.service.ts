import { Db } from '../db/types'
import * as categoriesRepository from '../db/repositories/categories.repository'
import { NotFoundError, toServiceError } from './errors'

export async function listCategories(
  db: Db
): ReturnType<typeof categoriesRepository.listCategories> {
  try {
    return await categoriesRepository.listCategories(db)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function getCategory(
  db: Db,
  id: number
): ReturnType<typeof categoriesRepository.getCategory> {
  try {
    return await categoriesRepository.getCategory(db, id)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function createCategory(
  db: Db,
  input: Parameters<typeof categoriesRepository.createCategory>[1]
): ReturnType<typeof categoriesRepository.createCategory> {
  try {
    return await categoriesRepository.createCategory(db, input)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function updateCategory(
  db: Db,
  id: number,
  input: Parameters<typeof categoriesRepository.updateCategory>[2]
): ReturnType<typeof categoriesRepository.updateCategory> {
  try {
    const category = await categoriesRepository.updateCategory(db, id, input)
    if (!category) {
      throw new NotFoundError('Category not found')
    }
    return category
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function deleteCategory(db: Db, id: number): Promise<void> {
  try {
    const deleted = await categoriesRepository.deleteCategory(db, id)
    if (!deleted) {
      throw new NotFoundError('Category not found')
    }
  } catch (error) {
    throw toServiceError(error)
  }
}
