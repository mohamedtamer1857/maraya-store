import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderRef: text('order_ref').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  notes: text('notes').default('').notNull(),
  paymentMethod: text('payment_method').notNull(),
  currency: text('currency').notNull(),
  totalAmount: integer('total_amount').notNull(),
  status: text('status').default('confirmed').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull(),
  title: text('title').notNull(),
  size: text('size').notNull(),
  quantity: integer('quantity').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
