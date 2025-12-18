const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const db = require('../db');

// All routes protected
router.use(auth);

// Create task
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const task = await db.createTask({ userId: req.user.id, ...body });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'create task error' });
  }
});

// List tasks for user
router.get('/', async (req, res) => {
  const tasks = await db.getTasksForUser(req.user.id);
  res.json(tasks);
});

// Get by id
router.get('/:id', async (req, res) => {
  const task = await db.getTaskById(req.params.id);
  if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'not found' });
  res.json(task);
});

// Update
router.put('/:id', async (req, res) => {
  const task = await db.getTaskById(req.params.id);
  if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'not found' });
  const updated = await db.updateTask(req.params.id, req.body);
  res.json(updated);
});

// Delete
router.delete('/:id', async (req, res) => {
  const task = await db.getTaskById(req.params.id);
  if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'not found' });
  const ok = await db.deleteTask(req.params.id);
  if (!ok) return res.status(500).json({ error: 'delete failed' });
  res.json({ message: 'deleted' });
});

/**
 * POST /api/tasks/:id/complete
 * Body: { date: 'YYYY-MM-DD' (optional), durationMinutes, satisfactionRating }
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task || task.userId !== req.user.id) return res.status(404).json({ error: 'not found' });

    const date = req.body.date || new Date().toISOString().slice(0,10);
    const duration = req.body.durationMinutes || 0;
    const satisfaction = req.body.satisfactionRating || null;

    const result = await db.markTaskComplete({
      taskId: req.params.id,
      userId: req.user.id,
      dateISO: date,
      durationMinutes: duration,
      satisfactionRating: satisfaction
    });

    res.json({ message: 'task marked complete', task: result.task, completion: result.completion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'complete failed' });
  }
});

module.exports = router;
