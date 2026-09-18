import { Db } from '../db/types'
import * as movementsRepository from '../db/repositories/movements.repository'
import { toServiceError } from './errors'

export type { ListMovementsFilters } from '../db/repositories/movements.repository'

export async function createMovement(
  db: Db,
  input: Parameters<typeof movementsRepository.createMovement>[1]
): ReturnType<typeof movementsRepository.createMovement> {
  try {
    return await movementsRepository.createMovement(db, input)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function listMovementsByItem(
  db: Db,
  itemId: number
): ReturnType<typeof movementsRepository.listMovementsByItem> {
  try {
    return await movementsRepository.listMovementsByItem(db, itemId)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function listMovements(
  db: Db,
  filters?: movementsRepository.ListMovementsFilters
): ReturnType<typeof movementsRepository.listMovements> {
  try {
    return await movementsRepository.listMovements(db, filters)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function recount(
  db: Db,
  input: Parameters<typeof movementsRepository.recount>[1]
): ReturnType<typeof movementsRepository.recount> {
  try {
    return await movementsRepository.recount(db, input)
  } catch (error) {
    throw toServiceError(error)
  }
}
