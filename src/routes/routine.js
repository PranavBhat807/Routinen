const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const routineController = require('../controllers/routineController');

router.get('/analytics', auth, routineController.analytics);
router.get('/suggestions', auth, routineController.suggestions);

module.exports = router;
