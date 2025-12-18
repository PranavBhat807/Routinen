const express = require('express');
const router = express.Router();

const auth = require('./auth');
const users = require('./users');
const tasks = require('./tasks');
const planner = require('./planner');
const routine = require('./routine');

router.use('/auth', auth);
router.use('/users', users);
router.use('/tasks', tasks);
router.use('/planner', planner);
router.use('/routine', routine);

module.exports = router;
