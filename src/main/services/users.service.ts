import { Db } from '../db/types'
import * as usersRepository from '../db/repositories/users.repository'
import { NotFoundError, toServiceError } from './errors'

export async function listUsers(db: Db): ReturnType<typeof usersRepository.listUsers> {
  try {
    return await usersRepository.listUsers(db)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function createUser(
  db: Db,
  input: Parameters<typeof usersRepository.createUser>[1]
): ReturnType<typeof usersRepository.createUser> {
  try {
    return await usersRepository.createUser(db, input)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function updateUser(
  db: Db,
  id: number,
  input: Parameters<typeof usersRepository.updateUser>[2]
): ReturnType<typeof usersRepository.updateUser> {
  try {
    const user = await usersRepository.updateUser(db, id, input)
    if (!user) {
      throw new NotFoundError('User not found')
    }
    return user
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function changePassword(
  db: Db,
  id: number,
  newPassword: string
): ReturnType<typeof usersRepository.changePassword> {
  try {
    return await usersRepository.changePassword(db, id, newPassword)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function deleteUser(db: Db, id: number): Promise<void> {
  try {
    const deleted = await usersRepository.deleteUser(db, id)
    if (!deleted) {
      throw new NotFoundError('User not found')
    }
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function verifyPassword(
  db: Db,
  username: string,
  password: string
): ReturnType<typeof usersRepository.verifyPassword> {
  try {
    return await usersRepository.verifyPassword(db, username, password)
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function authenticateUser(
  db: Db,
  username: string,
  password: string
): ReturnType<typeof usersRepository.authenticateUser> {
  try {
    return await usersRepository.authenticateUser(db, username, password)
  } catch (error) {
    throw toServiceError(error)
  }
}
