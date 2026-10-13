const express = require('express');
const { getTransactions, adjust } = require('../controllers/inventory.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.get('/transactions', getTransactions);
router.post('/adjust', adjust);

module.exports = router;
