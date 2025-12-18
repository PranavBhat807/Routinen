/**
 * taskController.js
 *
 * Handles CRUD operations for tasks
 */

const db = require('../db');

/**
 * Create a new task
 * POST /api/tasks
 */
exports.createTask = async (req, res) => {
  try {
    const task = await db.createTask({
      userId: req.user.id,
      title: req.body.title,
      description: req.body.description,
      estimatedMinutes: req.body.estimatedMinutes,
      priority: req.body.priority,
      preferredWindow: req.body.preferredWindow,
      dueDate: req.body.dueDate,
      repeat: req.body.repeat,
      timeOfDay: req.body.timeOfDay,
      reminderTime: req.body.reminderTime
    });

    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

/**
 * Get all tasks for logged-in user
 * GET /api/tasks
 */
exports.getTasks = async (req, res) => {
  try {
    const tasks = await db.getTasksForUser(req.user.id);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

/**
 * Get single task
 * GET /api/tasks/:id
 */
exports.getTaskById = async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);

    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

/**
 * Update a task
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);

    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await db.updateTask(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);

    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await db.deleteTask(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

/**
 * Mark task as completed (streak logic)
 * POST /api/tasks/:id/complete
 */
exports.completeTask = async (req, res) => {
  try {
    const result = await db.markTaskComplete({
      taskId: req.params.id,
      userId: req.user.id,
      dateISO: req.body.date || new Date().toISOString().slice(0, 10),
      durationMinutes: req.body.durationMinutes || 0,
      satisfactionRating: req.body.satisfactionRating || null
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete task' });
  }
};
