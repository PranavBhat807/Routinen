const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'missing auth token' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await db.getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: 'invalid token' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
};
