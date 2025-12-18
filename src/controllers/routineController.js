const db = require('../db');

module.exports = {
  async analytics(req, res) {
    try {
      const userId = req.user.id;
      const analytics = await db.getAnalyticsForUser(userId);
      res.json(analytics);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'analytics error' });
    }
  },

  async suggestions(req, res) {
    try {
      const userId = req.user.id;
      const suggestions = await db.generateSuggestionsForUser(userId);
      res.json({ suggestions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'suggestions error' });
    }
  }
};
