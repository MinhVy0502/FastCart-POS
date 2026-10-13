'use strict';
module.exports = {
  async up(qi, Sq) {
    await qi.createTable('Purchases', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      code: { type: Sq.STRING, unique: true },
      supplierId: { type: Sq.UUID, references: { model: 'Suppliers', key: 'id' } },
      userId: { type: Sq.UUID, references: { model: 'Users', key: 'id' } },
      totalAmount: { type: Sq.DECIMAL(10,2), defaultValue: 0 },
      note: Sq.TEXT,
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('PurchaseItems', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      purchaseId: { type: Sq.UUID, references: { model: 'Purchases', key: 'id' }, onDelete: 'CASCADE' },
      productId: { type: Sq.UUID, references: { model: 'Products', key: 'id' } },
      quantity: { type: Sq.INTEGER, allowNull: false },
      price: { type: Sq.DECIMAL(10,2), allowNull: false },
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('Sales', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      code: { type: Sq.STRING, unique: true },
      customerId: { type: Sq.UUID, references: { model: 'Customers', key: 'id' } },
      userId: { type: Sq.UUID, references: { model: 'Users', key: 'id' } },
      totalAmount: { type: Sq.DECIMAL(10,2), defaultValue: 0 },
      discount: { type: Sq.DECIMAL(10,2), defaultValue: 0 },
      finalAmount: { type: Sq.DECIMAL(10,2), defaultValue: 0 },
      paymentMethod: { type: Sq.STRING, defaultValue: 'CASH' },
      note: Sq.TEXT,
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('SaleItems', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      saleId: { type: Sq.UUID, references: { model: 'Sales', key: 'id' }, onDelete: 'CASCADE' },
      productId: { type: Sq.UUID, references: { model: 'Products', key: 'id' } },
      quantity: { type: Sq.INTEGER, allowNull: false },
      price: { type: Sq.DECIMAL(10,2), allowNull: false },
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('InventoryTransactions', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      productId: { type: Sq.UUID, references: { model: 'Products', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sq.ENUM('IN', 'OUT', 'ADJUST'), allowNull: false },
      quantity: { type: Sq.INTEGER, allowNull: false },
      referenceCode: Sq.STRING,
      note: Sq.TEXT,
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
  },
  async down(qi, Sq) {
    await qi.dropTable('InventoryTransactions');
    await qi.dropTable('SaleItems');
    await qi.dropTable('Sales');
    await qi.dropTable('PurchaseItems');
    await qi.dropTable('Purchases');
  }
};