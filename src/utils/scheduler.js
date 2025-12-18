const db = require('../db');
const { DateTime } = require('luxon');
const {
  getGeminiSuggestions,
  getGeminiSchedule
} = require('./geminiAI');

function defaultPreferences() {
  return {
    wakeTime: '07:00',
    sleepTime: '23:00',
    focusBlockMinutes: 90,
    breakMinutes: 15,
    maxDailyWorkMinutes: 8 * 60
  };
}

/**
 * Deterministic rule-based scheduler
 */
function generateRuleBasedSchedule(tasks, prefs, date) {
  const wake = DateTime.fromISO(`${date}T${prefs.wakeTime}`);
  const sleep = DateTime.fromISO(`${date}T${prefs.sleepTime}`);

  let availableMinutes = Math.min(
    sleep.diff(wake, 'minutes').minutes,
    prefs.maxDailyWorkMinutes
  );

  let cursor = wake;
  const schedule = [];

  for (const task of tasks) {
    if (availableMinutes <= 0) break;

    const duration = Math.min(
      task.estimatedMinutes || 30,
      prefs.focusBlockMinutes,
      availableMinutes
    );

    schedule.push({
      taskId: task.id,
      title: task.title,
      start: cursor.toISO(),
      durationMinutes: duration
    });

    cursor = cursor.plus({ minutes: duration + prefs.breakMinutes });
    availableMinutes -= duration;
  }

  return schedule;
}

/**
 * MAIN ENTRY
 */
async function generateDailyPlan(user, date, options = {}) {
  const mode = options.mode || "rule";
  const prefs = { ...defaultPreferences(), ...(user.preferences || {}) };

  const tasks = await db.getTasksForUser(user.id);

  // priority sorting
  const priorityScore = { high: 3, medium: 2, low: 1 };
  tasks.sort(
    (a, b) => (priorityScore[b.priority] || 2) - (priorityScore[a.priority] || 2)
  );

  const analytics = await db.getAnalyticsForUser(user.id);

  let schedule;

  // 🔥 KEY LOGIC DIFFERENCE
  if (mode === "ai") {
    try {
      schedule = await getGeminiSchedule({
        tasks,
        preferences: prefs,
        date
      });
    } catch (err) {
      console.error("⚠️ AI scheduling failed, fallback to rule");
      schedule = generateRuleBasedSchedule(tasks, prefs, date);
    }
  } else {
    schedule = generateRuleBasedSchedule(tasks, prefs, date);
  }

  const ruleSuggestions = await db.generateSuggestionsForUser(user.id);

  let aiSuggestions = [];
  if (mode === "ai") {
    aiSuggestions = await getGeminiSuggestions({
      user,
      date,
      tasks,
      schedule,
      analytics
    });
  }

  return {
    date,
    mode,
    schedule,
    suggestions: [...ruleSuggestions, ...aiSuggestions]
  };
}

module.exports = { generateDailyPlan };
