const express = require('express');
const { getDashboardData, getReports, getLowStock } = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.get('/dashboard', getDashboardData);
router.get('/reports', getReports);
router.get('/low-stock', getLowStock);

module.exports = router;
