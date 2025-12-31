/**
 * src/db/drizzle_schema.js
 */

const { pgTable, serial, text, integer, jsonb, timestamp, varchar, boolean, date } = require('drizzle-orm/pg-core');

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
  priority: varchar('priority', { length: 20 }).default('medium'), // 'low', 'medium', 'high'
  preferred_window: varchar('preferred_window', { length: 20 }),
  due_date: timestamp('due_date'),
  repeat: varchar('repeat', { length: 20 }).default('none'), // 'none', 'daily', 'weekly', 'monthly'
  time_of_day: varchar('time_of_day', { length: 20 }), // 'morning', 'afternoon', 'evening', 'night'
  reminder_time: varchar('reminder_time', { length: 10 }), // "HH:mm"
  streak: integer('streak').default(0),
  last_completed_date: date('last_completed_date'), // YYYY-MM-DD
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at').defaultNow()
});

const taskCompletions = pgTable('task_completions', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id').references(() => tasks.id),
  user_id: integer('user_id').references(() => users.id),
  date: date('date'), // YYYY-MM-DD
  duration_minutes: integer('duration_minutes'),
  satisfaction_rating: integer('satisfaction_rating'),
  created_at: timestamp('created_at').defaultNow()
});

module.exports = { users, tasks, taskCompletions };
