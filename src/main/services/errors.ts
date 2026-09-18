export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Repositories throw plain `Error`s with a fixed set of known messages for
// business-rule violations. Services normalize those into typed errors here
// so callers (eventually IPC handlers) can branch on error type instead of
// matching message strings themselves.
const NOT_FOUND_MESSAGES = new Set(['Item not found', 'Category not found', 'User not found'])

const VALIDATION_MESSAGES = new Set([
  'Cannot delete an item with existing movements',
  'Movement would take quantity below zero',
  'createMovement only accepts type "in" or "out"; use recount for "adjust"'
])

export function toServiceError(error: unknown): Error {
  if (error instanceof NotFoundError || error instanceof ValidationError) {
    return error
  }
  if (!(error instanceof Error)) {
    return new Error(String(error))
  }
  if (NOT_FOUND_MESSAGES.has(error.message)) {
    return new NotFoundError(error.message)
  }
  if (VALIDATION_MESSAGES.has(error.message)) {
    return new ValidationError(error.message)
  }
  return error
}
