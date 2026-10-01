import { asc, eq, sql } from 'drizzle-orm'
import { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from '../schema'

type Db = PgliteDatabase<typeof schema>
type Category = typeof schema.categories.$inferSelect

export type ListCategoriesFilters = {
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 50

export async function listCategories(
  db: Db,
  filters: ListCategoriesFilters = {}
): Promise<{ categories: Category[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE

  const [categories, [{ count }]] = await Promise.all([
    db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.categories)
  ])

  return { categories, total: count }
}

export async function getCategory(db: Db, id: number): Promise<Category | undefined> {
  const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, id))
  return category
}

export async function createCategory(db: Db, input: { name: string }): Promise<Category> {
  const [category] = await db.insert(schema.categories).values(input).returning()
  return category
}

export async function updateCategory(
  db: Db,
  id: number,
  input: { name: string }
): Promise<Category> {
  const [category] = await db
    .update(schema.categories)
    .set(input)
    .where(eq(schema.categories.id, id))
    .returning()

  return category
}

export async function deleteCategory(db: Db, id: number): Promise<boolean> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.items)
    .where(eq(schema.items.categoryId, id))

  if (count > 0) {
    throw new Error('Cannot delete a category with existing items')
  }

  const deleted = await db
    .delete(schema.categories)
    .where(eq(schema.categories.id, id))
    .returning({ id: schema.categories.id })

  return deleted.length > 0
}
