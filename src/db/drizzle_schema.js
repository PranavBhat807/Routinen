/**
 * Example Drizzle schema (illustrative). When you enable Postgres/Neon,
 * implement the drizzle adapter in src/db/index.js and use a schema like this.
 *
 * Note: This file is illustrative; don't require it yet in the running in-memory setup.
 */

const { pgTable, serial, text, integer, jsonb, timestamp, varchar } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  password_hash: text('password_hash'),
  preferences: jsonb('preferences'),
  created_at: timestamp('created_at').defaultNow()
});

const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
  title: text('title'),
  description: text('description'),
  estimated_minutes: integer('estimated_minutes').default(30),
  priority: integer('priority').default(3),
  preferred_window: varchar('preferred_window', { length: 20 }),
  deadline: timestamp('deadline'),
  recurring: jsonb('recurring'),
  created_at: timestamp('created_at').defaultNow()
});

module.exports = { users, tasks };
