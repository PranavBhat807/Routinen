const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const SALT_ROUNDS = 10;

module.exports = {
  async signup(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email & password required' });

      const existing = await db.getUserByEmail(email);
      if (existing) return res.status(400).json({ error: 'email already exists' });

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await db.createUser({ name, email, passwordHash });
      const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

      res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email & password required' });

      const user = await db.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'invalid credentials' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'invalid credentials' });

      const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
      res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
  }
};
