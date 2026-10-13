const express = require('express');
const purchaseCtrl = require('../controllers/purchase.controller');
const saleCtrl = require('../controllers/sale.controller');
const { protect } = require('../middlewares/auth.middleware');

const purchaseRouter = express.Router();
purchaseRouter.use(protect);
purchaseRouter.get('/', purchaseCtrl.getAll);
purchaseRouter.get('/:id', purchaseCtrl.getOne);
purchaseRouter.post('/', purchaseCtrl.create);

const saleRouter = express.Router();
saleRouter.use(protect);
saleRouter.get('/', saleCtrl.getAll);
saleRouter.get('/:id', saleCtrl.getOne);
saleRouter.post('/', saleCtrl.create);
saleRouter.post('/:id/cancel', saleCtrl.cancel);

module.exports = { purchaseRouter, saleRouter };
