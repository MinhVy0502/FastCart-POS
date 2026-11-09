const express = require('express');
const { 
  getAll, getOne, getBySku, create, update, remove, 
  bulkImport, getHistory, getBatches, addBatch, getExpiringProducts 
} = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getAll);
router.get('/expiring', getExpiringProducts);
router.get('/sku/:sku', getBySku);
router.get('/:id/history', getHistory);
router.get('/:id/batches', getBatches);
router.post('/:id/batches', addBatch);
router.post('/import', bulkImport);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
