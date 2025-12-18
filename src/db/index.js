/**
 * src/db/index.js
 * Enhanced in-memory DB adapter with smart-routine helpers.
 *
 * Note: Promise-based API to match earlier usage.
 */

const config = require('../config');
const { DateTime } = require('luxon');

if (!config.databaseUrl) {
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

  module.exports = {
    // ---------- Users ----------
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

    // ---------- Tasks ----------
    /**
     * createTask accepts an object that may include:
     * title, description, estimatedMinutes, priority,
     * preferredWindow, deadline, recurring (repeat), timeOfDay,
     * reminderTime
     */
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
        repeat: task.repeat || 'none', // none | daily | weekly | monthly
        timeOfDay: task.timeOfDay || null, // morning/afternoon/evening/night
        reminderTime: task.reminderTime || null, // "HH:mm"
        streak: Number(task.streak || 0),
        lastCompletedDate: task.lastCompletedDate || null, // YYYY-MM-DD
        completed: Boolean(task.completed || false),
        createdAt: new Date().toISOString()
      };
      db.tasks.push(newTask);
      return newTask;
    },

    async getTasksForUser(userId) {
      return db.tasks.filter(t => t.userId === Number(userId));
    },

    // optional: get tasks for a specific date (considers dueDate and repeats)
    async getTasksForUserOnDate(userId, dateISO) {
      const dateStr = DateTime.fromISO(dateISO).toISODate();
      const tasks = db.tasks.filter(t => t.userId === Number(userId)).filter(t => {
        if (t.dueDate && DateTime.fromISO(t.dueDate).toISODate() !== dateStr && t.repeat === 'none') {
          return false;
        }
        // repeating tasks: include if repeat matches
        if (t.repeat === 'daily') return true;
        if (t.repeat === 'weekly') {
          // include if created day-of-week matches this date (simplistic)
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

    // This updateTask is general-purpose. For marking complete use markTaskComplete to handle streak logic.
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

    // ---------- Task completion + streak logic ----------
    /**
     * Mark a task completed for a date (dateISO YYYY-MM-DD).
     * Updates streak and lastCompletedDate in a smart way.
     */
    async markTaskComplete({ taskId, userId, dateISO, durationMinutes = 0, satisfactionRating = null }) {
      const t = db.tasks.find(x => x.id === Number(taskId) && x.userId === Number(userId));
      if (!t) throw new Error('task not found');

      const date = DateTime.fromISO(dateISO).toISODate();
      const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();

      // Add completion record
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

      // Update streak only once per day
      if (t.lastCompletedDate === date) {
        // already completed today - do nothing additional
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

    // ---------- Repeating tasks helpers ----------
    async getRepeatingTasks() {
      return db.tasks.filter(t => ['daily', 'weekly', 'monthly'].includes(t.repeat));
    },

    // create a new task based on existing one for a target date
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

    // ---------- Analytics & Suggestions ----------
    async getAnalyticsForUser(userId) {
      const allTasks = db.tasks.filter(t => t.userId === Number(userId));
      const completions = db.taskCompletions.filter(c => c.userId === Number(userId));
      const today = todayISO();
      const weekStart = DateTime.local().startOf('week').toISODate();

      const tasksCompletedToday = completions.filter(c => c.date === today).length;
      const tasksCompletedThisWeek = completions.filter(c => c.date >= weekStart).length;

      // longest streak: from tasks
      let longestStreak = 0;
      const streaks = allTasks.map(t => {
        if (t.streak && t.streak > longestStreak) longestStreak = t.streak;
        return { taskId: t.id, title: t.title, streak: t.streak || 0 };
      });

      // completion rate: completions / tasks created this week (approx)
      const tasksCreatedThisWeek = allTasks.filter(t => DateTime.fromISO(t.createdAt).toISODate() >= weekStart).length || 1;
      const completionRate = Math.round((tasksCompletedThisWeek / tasksCreatedThisWeek) * 100);

      // most productive time (simple heuristic: count completions by timeOfDay of task)
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
      // simple rule-based suggestions, can be extended
      const analytics = await this.getAnalyticsForUser(userId);
      const suggestions = [];

      if (analytics.tasksCompletedToday < 1) {
        suggestions.push({ text: 'You completed 0 tasks today — try listing 3 small tasks for today.', confidence: 'high' });
      }

      // If most productive time is evening, suggest scheduling heavy tasks then
      suggestions.push({
        text: `You are most productive during the ${analytics.mostProductiveTime}. Consider scheduling top priority tasks in the ${analytics.mostProductiveTime}.`,
        confidence: 'medium'
      });

      // If any streaks exist and one is broken (streak == 0 but created long ago), warn
      const broken = analytics.streaks.filter(s => s.streak === 0 && s.title.toLowerCase().includes('wake')).slice(0,1);
      if (broken.length) {
        suggestions.push({ text: `You broke a routine (e.g., "${broken[0].title}"). Try reducing the goal or setting a reminder.`, confidence: 'medium' });
      }

      return suggestions;
    },

    // debugging
    _dump() {
      return db;
    }
  };
} else {
  console.log('🔧 DATABASE_URL present — Postgres adapter not implemented for smart demo. Remove DATABASE_URL to use in-memory demo.');
  throw new Error('Postgres adapter not implemented in this demo. Remove DATABASE_URL to use in-memory adapter.');
}
