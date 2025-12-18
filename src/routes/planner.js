const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const scheduler = require('../utils/scheduler');

// GET /planner/today
router.get('/today', auth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  const mode = req.query.mode || "rule"; // 👈 NEW

  try {
    const plan = await scheduler.generateDailyPlan(req.user, date, { mode });
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'planner error' });
  }
});

module.exports = router;
