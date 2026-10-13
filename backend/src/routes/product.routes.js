const express = require('express');
const { getAll, getOne, getBySku, create, update, remove, bulkImport } = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getAll);
router.get('/sku/:sku', getBySku);
router.post('/import', bulkImport);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
