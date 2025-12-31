/**
 * src/cron/scheduler.js
 * Cron jobs for repeating tasks & reminders (in-memory demo).
 */

const cron = require('node-cron');
const db = require('../db');
const { sendNotification } = require('../utils/notification');
const { DateTime } = require('luxon');

function startCronJobs() {
  // Run daily at 00:05 to generate next-day repeating tasks
  cron.schedule('5 0 * * *', async () => {
    try {
      console.log('⏰ Cron: generating repeating tasks for next day');
      const tomorrow = DateTime.local().plus({ days: 1 }).toISODate();
      const repeating = await db.getRepeatingTasks();
      for (const t of repeating) {
        // naive: always create a new instance for tomorrow if dueDate != tomorrow
        // You may want to avoid duplicates in production (keep ids/refs)
        await db.createTaskForDate(t, tomorrow);
      }
      console.log('⏰ Cron: done generating repeating tasks');
    } catch (err) {
      console.error('Cron error:', err);
    }
  });

  // Example: reminders every minute (very chatty). For demo, comment if noisy.
  cron.schedule('* * * * *', async () => {
    // This is a simple demo: find tasks with reminderTime==current time hh:mm and not completed
    try {
      const now = DateTime.local();
      const hhmm = now.toFormat('HH:mm');
      const allUsers = await db.getAllUsers();
      for (const u of allUsers) {
        const tasks = (await db.getTasksForUser(u.id)).filter(t => t.reminderTime === hhmm && !t.completed);
        for (const t of tasks) {
          const msg = `Task "${t.title}" is scheduled for ${t.reminderTime}`;
          console.log(`🔔 Reminder for ${u.email}: ${msg}`);
          sendNotification('Task Reminder', msg);
        }
      }
    } catch (err) {
      console.error('Reminders cron error', err);
    }
  });

  console.log('🕒 Cron jobs started');
}

module.exports = { startCronJobs };
