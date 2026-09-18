import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../schema'

type Db = PgliteDatabase<typeof schema>
type PublicUser = Omit<typeof schema.users.$inferSelect, 'passwordHash'>

const scryptAsync = promisify(scrypt)

async function deriveKey(password: string, salt: string): Promise<Buffer> {
  return (await scryptAsync(password, salt, 64)) as Buffer
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await deriveKey(password, salt)
  return `${salt}:${derivedKey.toString('hex')}`
}

async function passwordMatches(password: string, passwordHash: string): Promise<boolean> {
  const [salt, storedHash] = passwordHash.split(':')
  const derivedKey = await deriveKey(password, salt)
  const storedKey = Buffer.from(storedHash, 'hex')
  return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey)
}

const userSelection = {
  id: schema.users.id,
  username: schema.users.username,
  createdAt: schema.users.createdAt
}

export async function listUsers(db: Db): Promise<PublicUser[]> {
  return db.select(userSelection).from(schema.users)
}

export async function createUser(
  db: Db,
  input: { username: string; password: string }
): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password)

  const [user] = await db
    .insert(schema.users)
    .values({ username: input.username, passwordHash })
    .returning(userSelection)

  return user
}

export async function updateUser(
  db: Db,
  id: number,
  input: { username?: string }
): Promise<PublicUser> {
  const [user] = await db
    .update(schema.users)
    .set(input)
    .where(eq(schema.users.id, id))
    .returning(userSelection)

  return user
}

export async function changePassword(db: Db, id: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword)
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, id))
}

export async function deleteUser(db: Db, id: number): Promise<boolean> {
  const deleted = await db
    .delete(schema.users)
    .where(eq(schema.users.id, id))
    .returning({ id: schema.users.id })

  return deleted.length > 0
}

export async function verifyPassword(db: Db, username: string, password: string): Promise<boolean> {
  const [user] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.username, username))

  if (!user) return false
  return passwordMatches(password, user.passwordHash)
}

export async function authenticateUser(
  db: Db,
  username: string,
  password: string
): Promise<PublicUser | null> {
  const [user] = await db
    .select({ ...userSelection, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.username, username))

  if (!user) return null
  if (!(await passwordMatches(password, user.passwordHash))) return null

  return { id: user.id, username: user.username, createdAt: user.createdAt }
}
