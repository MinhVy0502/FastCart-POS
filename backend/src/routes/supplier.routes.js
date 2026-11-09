const express = require('express');
const { getAll, getOne, create, update, remove, payDebt } = require('../controllers/supplier.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.get('/', getAll);
router.get('/:id', getOne);
router.post('/:id/pay-debt', payDebt);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
