const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const db = require('../db');

router.get('/me', auth, async (req, res) => {
  const u = req.user;
  res.json({ id: u.id, name: u.name, email: u.email, preferences: u.preferences || {} });
});

router.put('/me/preferences', auth, async (req, res) => {
  const prefs = req.body;
  const updated = await db.updateUserPreferences(req.user.id, prefs);
  res.json({ user: updated });
});

module.exports = router;
