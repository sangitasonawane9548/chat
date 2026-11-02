const express = require('express');
const reportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Require user authentication for submitting and viewing reports
router.use(requireAuth);

router.post('/', reportController.createReport);
router.get('/my', reportController.getMySubmittedReports);

module.exports = router;

