const express = require('express');
const { get, update } = require('../controllers/setting.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.get('/', get);
router.put('/', update);

module.exports = router;
