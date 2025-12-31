/**
 * src/db/index.js
 * Enhanced in-memory DB adapter with smart-routine helpers.
 * Now supports Neon DB via Drizzle ORM if DATABASE_URL is set.
 */

const config = require('../config');
const { DateTime } = require('luxon');
const { eq, and, desc, sql, gte, lte } = require('drizzle-orm');

// ----------------------------------------------------------------------
// IN-MEMORY ADAPTER (Fallback)
// ----------------------------------------------------------------------
function createInMemoryAdapter() {
  console.log('🔧 Using in-memory DB adapter (smart mode).');

  const db = {
    users: [],
    tasks: [],
    taskCompletions: [],
  };

  let userId = 1;
  let taskId = 1;

  // helper: YYYY-MM-DD
  const todayISO = (d = null) => (d ? DateTime.fromISO(d).toISODate() : DateTime.local().toISODate());

  return {
    async getAllUsers() {
      return db.users;
    },
    async createUser({ name, email, passwordHash }) {
      const user = { id: userId++, name, email, passwordHash, preferences: {}, createdAt: new Date().toISOString() };
      db.users.push(user);
      return user;
    },
    async getUserByEmail(email) {
      return db.users.find(u => u.email === email) || null;
    },
    async getUserById(id) {
      return db.users.find(u => u.id === Number(id)) || null;
    },
    async updateUserPreferences(id, preferences) {
      const u = db.users.find(x => x.id === Number(id));
      if (!u) return null;
      u.preferences = { ...u.preferences, ...preferences };
      return u;
    },
    async createTask(task) {
      const newTask = {
        id: taskId++,
        userId: Number(task.userId),
        title: task.title || 'Untitled task',
        description: task.description || '',
        estimatedMinutes: Number(task.estimatedMinutes || 30),
        priority: task.priority || 'medium',
        preferredWindow: task.preferredWindow || null,
        dueDate: task.dueDate || null,
        repeat: task.repeat || 'none',
        timeOfDay: task.timeOfDay || null,
        reminderTime: task.reminderTime || null,
        streak: Number(task.streak || 0),
        lastCompletedDate: task.lastCompletedDate || null,
        completed: Boolean(task.completed || false),
        createdAt: new Date().toISOString()
      };
      db.tasks.push(newTask);
      return newTask;
    },
    async getTasksForUser(userId) {
      return db.tasks.filter(t => t.userId === Number(userId));
    },
    async getTasksForUserOnDate(userId, dateISO) {
      const dateStr = DateTime.fromISO(dateISO).toISODate();
      const tasks = db.tasks.filter(t => t.userId === Number(userId)).filter(t => {
        if (t.dueDate && DateTime.fromISO(t.dueDate).toISODate() !== dateStr && t.repeat === 'none') {
          return false;
        }
        if (t.repeat === 'daily') return true;
        if (t.repeat === 'weekly') {
          return DateTime.fromISO(t.createdAt).weekday === DateTime.fromISO(dateStr).weekday;
        }
        if (t.repeat === 'monthly') {
          return DateTime.fromISO(t.createdAt).day === DateTime.fromISO(dateStr).day;
        }
        return true;
      });
      return tasks;
    },
    async getTaskById(taskId) {
      return db.tasks.find(t => t.id === Number(taskId)) || null;
    },
    async updateTask(taskId, patch) {
      const t = db.tasks.find(x => x.id === Number(taskId));
      if (!t) return null;
      Object.assign(t, patch);
      return t;
    },
    async deleteTask(taskId) {
      const idx = db.tasks.findIndex(x => x.id === Number(taskId));
      if (idx === -1) return false;
      db.tasks.splice(idx, 1);
      return true;
    },
    async markTaskComplete({ taskId, userId, dateISO, durationMinutes = 0, satisfactionRating = null }) {
      const t = db.tasks.find(x => x.id === Number(taskId) && x.userId === Number(userId));
      if (!t) throw new Error('task not found');

      const date = DateTime.fromISO(dateISO).toISODate();
      const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();

      const rec = {
        id: db.taskCompletions.length + 1,
        taskId: Number(taskId),
        userId: Number(userId),
        date,
        durationMinutes: Number(durationMinutes),
        satisfactionRating: satisfactionRating === null ? null : Number(satisfactionRating),
        createdAt: new Date().toISOString()
      };
      db.taskCompletions.push(rec);

      if (t.lastCompletedDate === date) {
        // no op
      } else {
        if (t.lastCompletedDate === yesterday) {
          t.streak = (Number(t.streak) || 0) + 1;
        } else {
          t.streak = 1;
        }
        t.lastCompletedDate = date;
        t.completed = true;
      }
      return { task: t, completion: rec };
    },
    async getTaskCompletionsForUserOnDate(userId, date) {
      const dateStr = DateTime.fromISO(date).toISODate();
      return db.taskCompletions.filter(r => r.userId === Number(userId) && r.date === dateStr);
    },
    async getRepeatingTasks() {
      return db.tasks.filter(t => ['daily', 'weekly', 'monthly'].includes(t.repeat));
    },
    async createTaskForDate(originalTask, targetDateISO) {
      const copy = {
        userId: originalTask.userId,
        title: originalTask.title,
        description: originalTask.description,
        estimatedMinutes: originalTask.estimatedMinutes,
        priority: originalTask.priority,
        preferredWindow: originalTask.preferredWindow,
        dueDate: targetDateISO,
        repeat: originalTask.repeat,
        timeOfDay: originalTask.timeOfDay,
        reminderTime: originalTask.reminderTime,
        completed: false,
        streak: 0,
        lastCompletedDate: null
      };
      return this.createTask(copy);
    },
    async getAnalyticsForUser(userId) {
      const allTasks = db.tasks.filter(t => t.userId === Number(userId));
      const completions = db.taskCompletions.filter(c => c.userId === Number(userId));
      const today = todayISO();
      const weekStart = DateTime.local().startOf('week').toISODate();

      const tasksCompletedToday = completions.filter(c => c.date === today).length;
      const tasksCompletedThisWeek = completions.filter(c => c.date >= weekStart).length;

      let longestStreak = 0;
      const streaks = allTasks.map(t => {
        if (t.streak && t.streak > longestStreak) longestStreak = t.streak;
        return { taskId: t.id, title: t.title, streak: t.streak || 0 };
      });

      const tasksCreatedThisWeek = allTasks.filter(t => DateTime.fromISO(t.createdAt).toISODate() >= weekStart).length || 1;
      const completionRate = Math.round((tasksCompletedThisWeek / tasksCreatedThisWeek) * 100);

      const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
      completions.forEach(c => {
        const task = db.tasks.find(t => t.id === c.taskId);
        if (task && task.timeOfDay) timeBuckets[task.timeOfDay] = (timeBuckets[task.timeOfDay] || 0) + 1;
      });
      const mostProductiveTime = Object.keys(timeBuckets).reduce((a, b) => (timeBuckets[a] > timeBuckets[b] ? a : b), 'morning');

      return {
        tasksCompletedToday,
        tasksCompletedThisWeek,
        streaks,
        longestStreak,
        completionRate: isNaN(completionRate) ? 0 : completionRate,
        mostProductiveTime
      };
    },
    async generateSuggestionsForUser(userId) {
      const analytics = await this.getAnalyticsForUser(userId);
      const suggestions = [];
      if (analytics.tasksCompletedToday < 1) {
        suggestions.push({ text: 'You completed 0 tasks today — try listing 3 small tasks for today.', confidence: 'high' });
      }
      suggestions.push({
        text: `You are most productive during the ${analytics.mostProductiveTime}. Consider scheduling top priority tasks in the ${analytics.mostProductiveTime}.`,
        confidence: 'medium'
      });
      const broken = analytics.streaks.filter(s => s.streak === 0 && s.title.toLowerCase().includes('wake')).slice(0, 1);
      if (broken.length) {
        suggestions.push({ text: `You broke a routine (e.g., "${broken[0].title}"). Try reducing the goal or setting a reminder.`, confidence: 'medium' });
      }
      return suggestions;
    },
     _dump() { return db; }
  };
}

// ----------------------------------------------------------------------
// NEON / POSTGRES ADAPTER
// ----------------------------------------------------------------------
function createNeonAdapter(databaseUrl) {
  console.log('🚀 Using Neon DB adapter (Postgres).');
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { Pool } = require('pg');
  const schema = require('./drizzle_schema');
  
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const { users, tasks, taskCompletions } = schema;

  // Helper to standardise task output to match in-memory format (camelCase)
  const mapTask = (t) => t ? ({
    id: t.id,
    userId: t.user_id,
    title: t.title,
    description: t.description,
    estimatedMinutes: t.estimated_minutes,
    priority: t.priority,
    preferredWindow: t.preferred_window,
    dueDate: t.due_date ? t.due_date.toISOString() : null,
    repeat: t.repeat, // db has default 'none'
    timeOfDay: t.time_of_day,
    reminderTime: t.reminder_time,
    streak: t.streak,
    lastCompletedDate: t.last_completed_date, // string YYYY-MM-DD
    completed: t.completed,
    createdAt: t.created_at.toISOString()
  }) : null;

  return {
    async getAllUsers() {
      const all = await db.select().from(users);
      return all.map(u => ({ ...u, passwordHash: u.password_hash, createdAt: u.created_at.toISOString() }));
    },
    async createUser({ name, email, passwordHash }) {
      const [user] = await db.insert(users).values({
        name,
        email,
        password_hash: passwordHash,
        preferences: {}
      }).returning();
      return { ...user, passwordHash: user.password_hash, createdAt: user.created_at.toISOString() };
    },
    async getUserByEmail(email) {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) return null;
      return { ...user, passwordHash: user.password_hash, createdAt: user.created_at.toISOString() };
    },
    async getUserById(id) {
      const [user] = await db.select().from(users).where(eq(users.id, Number(id)));
      if (!user) return null;
      return { ...user, passwordHash: user.password_hash, createdAt: user.created_at.toISOString() };
    },
    async updateUserPreferences(id, preferences) {
      const [currentUser] = await db.select().from(users).where(eq(users.id, Number(id)));
      if (!currentUser) return null;
      const newPrefs = { ...currentUser.preferences, ...preferences };
      const [updated] = await db.update(users).set({ preferences: newPrefs }).where(eq(users.id, Number(id))).returning();
      return { ...updated, passwordHash: updated.password_hash, createdAt: updated.created_at.toISOString() };
    },

    async createTask(task) {
      const [newTask] = await db.insert(tasks).values({
        user_id: Number(task.userId),
        title: task.title || 'Untitled task',
        description: task.description || '',
        estimated_minutes: Number(task.estimatedMinutes || 30),
        priority: task.priority || 'medium',
        preferred_window: task.preferredWindow || null,
        due_date: task.dueDate ? new Date(task.dueDate) : null,
        repeat: task.repeat || 'none',
        time_of_day: task.timeOfDay || null,
        reminder_time: task.reminderTime || null,
        streak: Number(task.streak || 0),
        last_completed_date: task.lastCompletedDate || null,
        completed: Boolean(task.completed || false)
      }).returning();
      return mapTask(newTask);
    },

    async getTasksForUser(userId) {
      const res = await db.select().from(tasks).where(eq(tasks.user_id, Number(userId)));
      return res.map(mapTask);
    },

    async getTasksForUserOnDate(userId, dateISO) {
       // Note: Doing filtering in JS to match complex repeat logic perfectly, 
       // but ideally this should be SQL. For now, fetching user's tasks and filtering is safe for small scale.
       // Only optimization: filter by userId in DB.
       const dateStr = DateTime.fromISO(dateISO).toISODate();
       const allTasks = await this.getTasksForUser(userId);
       
       return allTasks.filter(t => {
        if (t.dueDate && DateTime.fromISO(t.dueDate).toISODate() !== dateStr && t.repeat === 'none') {
          return false;
        }
        if (t.repeat === 'daily') return true;
        if (t.repeat === 'weekly') {
          return DateTime.fromISO(t.createdAt).weekday === DateTime.fromISO(dateStr).weekday;
        }
        if (t.repeat === 'monthly') {
          return DateTime.fromISO(t.createdAt).day === DateTime.fromISO(dateStr).day;
        }
        return true;
      });
    },

    async getTaskById(taskId) {
      const [t] = await db.select().from(tasks).where(eq(tasks.id, Number(taskId)));
      return mapTask(t);
    },

    async updateTask(taskId, patch) {
       const [current] = await db.select().from(tasks).where(eq(tasks.id, Number(taskId)));
       if (!current) return null;
       
       // map keys back to snake_case
       const updateData = {};
       if (patch.title !== undefined) updateData.title = patch.title;
       if (patch.description !== undefined) updateData.description = patch.description;
       if (patch.completed !== undefined) updateData.completed = patch.completed;
       if (patch.streak !== undefined) updateData.streak = patch.streak;
       if (patch.lastCompletedDate !== undefined) updateData.last_completed_date = patch.lastCompletedDate;
       // ... add others if needed by the app logic
       
       const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, Number(taskId))).returning();
       return mapTask(updated);
    },

    async deleteTask(taskId) {
      const res = await db.delete(tasks).where(eq(tasks.id, Number(taskId))).returning();
      return res.length > 0;
    },

    async markTaskComplete({ taskId, userId, dateISO, durationMinutes = 0, satisfactionRating = null }) {
      const t = await this.getTaskById(taskId);
      if (!t || t.userId !== Number(userId)) throw new Error('task not found');

      const date = DateTime.fromISO(dateISO).toISODate();
      const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();

      // Create completion
      const [rec] = await db.insert(taskCompletions).values({
         task_id: Number(taskId),
         user_id: Number(userId),
         date: date,
         duration_minutes: Number(durationMinutes),
         satisfaction_rating: satisfactionRating ? Number(satisfactionRating) : null
      }).returning();

      // formatted completion
      const formattedRec = {
          id: rec.id,
          taskId: rec.task_id,
          userId: rec.user_id,
          date: rec.date, // might be Date depending on driver, ensure string if needed
          durationMinutes: rec.duration_minutes,
          satisfactionRating: rec.satisfaction_rating,
          createdAt: rec.created_at.toISOString()
      };

      // Update streak
      let newStreak = t.streak;
      let newLastCompleted = t.lastCompletedDate;
      let newCompleted = t.completed;

      if (t.lastCompletedDate === date) {
        // already completed
      } else {
        if (t.lastCompletedDate === yesterday) {
          newStreak = (Number(t.streak) || 0) + 1;
        } else {
          newStreak = 1;
        }
        newLastCompleted = date;
        newCompleted = true;
        
        await db.update(tasks).set({
           streak: newStreak,
           last_completed_date: newLastCompleted,
           completed: true
        }).where(eq(tasks.id, Number(taskId)));
      }
      
      // Update local object to return
      t.streak = newStreak;
      t.lastCompletedDate = newLastCompleted;
      t.completed = newCompleted;

      return { task: t, completion: formattedRec };
    },

    async getTaskCompletionsForUserOnDate(userId, date) {
      // date is YYYY-MM-DD string
      const res = await db.select().from(taskCompletions)
        .where(and(eq(taskCompletions.user_id, Number(userId)), eq(taskCompletions.date, date)));
        
      return res.map(r => ({
          id: r.id,
          taskId: r.task_id,
          userId: r.user_id,
          date: r.date,
          durationMinutes: r.duration_minutes,
          satisfactionRating: r.satisfaction_rating,
          createdAt: r.created_at.toISOString()
      }));
    },

    async getRepeatingTasks() {
      // rough efficient query? Or just filter client side for safety with enum strings
      // we can do WHERE repeat IN ('daily', 'weekly', 'monthly')
      // but 'inArray' needs careful import. simple property check is okay for now.
       const res = await db.select().from(tasks); // fetch all? maybe too heavy.
       // Better:
       const all = await db.select().from(tasks).where(sql`${tasks.repeat} IN ('daily', 'weekly', 'monthly')`);
       return all.map(mapTask);
    },

    async createTaskForDate(originalTask, targetDateISO) {
      // Reuse logic
      const copy = {
        userId: originalTask.userId,
        title: originalTask.title,
        description: originalTask.description,
        estimatedMinutes: originalTask.estimatedMinutes,
        priority: originalTask.priority,
        preferredWindow: originalTask.preferredWindow,
        dueDate: targetDateISO,
        repeat: originalTask.repeat,
        timeOfDay: originalTask.timeOfDay,
        reminderTime: originalTask.reminderTime,
        completed: false,
        streak: 0,
        lastCompletedDate: null
      };
      return this.createTask(copy);
    },

    async getAnalyticsForUser(userId) {
       // Can optimize with SQL aggregations, but for strict compatibility keeping logic similar
       const allTasks = await this.getTasksForUser(userId);
       const completionsRes = await db.select().from(taskCompletions).where(eq(taskCompletions.user_id, Number(userId)));
       
       const completions = completionsRes.map(c => ({...c, taskId: c.task_id, date: c.date instanceof Date ? DateTime.fromJSDate(c.date).toISODate() : c.date}));
       
       const today = DateTime.local().toISODate();
       const weekStart = DateTime.local().startOf('week').toISODate();

       const tasksCompletedToday = completions.filter(c => c.date === today).length;
       const tasksCompletedThisWeek = completions.filter(c => c.date >= weekStart).length;

       let longestStreak = 0;
       const streaks = allTasks.map(t => {
        if (t.streak && t.streak > longestStreak) longestStreak = t.streak;
        return { taskId: t.id, title: t.title, streak: t.streak || 0 };
       });
       
       const tasksCreatedThisWeek = allTasks.filter(t => DateTime.fromISO(t.createdAt).toISODate() >= weekStart).length || 1;
       const completionRate = Math.round((tasksCompletedThisWeek / tasksCreatedThisWeek) * 100);
       
       // most productive time
       const timeBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
       completions.forEach(c => {
         const task = allTasks.find(t => t.id === c.taskId);
         if (task && task.timeOfDay) timeBuckets[task.timeOfDay] = (timeBuckets[task.timeOfDay] || 0) + 1;
       });
       const mostProductiveTime = Object.keys(timeBuckets).reduce((a, b) => (timeBuckets[a] > timeBuckets[b] ? a : b), 'morning');

       return {
        tasksCompletedToday,
        tasksCompletedThisWeek,
        streaks,
        longestStreak,
        completionRate: isNaN(completionRate) ? 0 : completionRate,
        mostProductiveTime
      };
    },

    async generateSuggestionsForUser(userId) {
       // logic is same as in-memory, assumes getAnalyticsForUser returns same shape
       const analytics = await this.getAnalyticsForUser(userId);
       const suggestions = [];

       if (analytics.tasksCompletedToday < 1) {
         suggestions.push({ text: 'You completed 0 tasks today — try listing 3 small tasks for today.', confidence: 'high' });
       }
       suggestions.push({
         text: `You are most productive during the ${analytics.mostProductiveTime}. Consider scheduling top priority tasks in the ${analytics.mostProductiveTime}.`,
         confidence: 'medium'
       });

       const broken = analytics.streaks.filter(s => s.streak === 0 && s.title.toLowerCase().includes('wake')).slice(0,1);
       if (broken.length) {
         suggestions.push({ text: `You broke a routine (e.g., "${broken[0].title}"). Try reducing the goal or setting a reminder.`, confidence: 'medium' });
       }
       return suggestions;
    },
    
    _dump() { return { msg: "postgres adapter active" }; }
  };
}

module.exports = config.databaseUrl ? createNeonAdapter(config.databaseUrl) : createInMemoryAdapter();
