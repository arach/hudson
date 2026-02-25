import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const signups = sqliteTable('signups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  useCase: text('use_case'),
  context: text('context'),
  ip: text('ip'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
