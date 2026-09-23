import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core'

export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjust'])

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username').notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull().unique()
})

export const items = pgTable(
  'items',
  {
    id: serial('id').primaryKey(),
    name: varchar('name').notNull().unique(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    // piece or carton
    unit: varchar('unit').notNull().default('piece'),
    quantity: integer('quantity').notNull().default(0),
    minQty: integer('min_qty').notNull().default(10),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  }
)

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    type: movementTypeEnum('type').notNull(),
    quantity: integer('quantity').notNull(),
    note: text('note'),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  (table) => [
    index('stock_movements_item_id_created_at_idx').on(table.itemId, table.createdAt),
    // "in"/"out" quantity is a magnitude - direction comes from `type`.
    // "adjust" quantity is the signed +/- change applied to reach the
    // counted value, so it can't be zero (recount() skips the insert
    // entirely when nothing changed) but can be negative.
    check(
      'stock_movements_quantity_valid',
      sql`(${table.type} IN ('in', 'out') AND ${table.quantity} > 0) OR (${table.type} = 'adjust' AND ${table.quantity} <> 0)`
    )
  ]
)
