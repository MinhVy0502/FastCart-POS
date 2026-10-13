const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join('e:', 'DaiLyBanLe', 'backend');

const files = {
  'src/models/supplier.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model { static associate(models) { Supplier.hasMany(models.Purchase, { foreignKey: 'supplierId' }); } }
  Supplier.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING
  }, { sequelize, modelName: 'Supplier' });
  return Supplier;
};`,

  'src/models/customer.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Customer extends Model { static associate(models) { Customer.hasMany(models.Sale, { foreignKey: 'customerId' }); } }
  Customer.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    totalSpent: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
  }, { sequelize, modelName: 'Customer' });
  return Customer;
};`,

  'src/models/purchase.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Purchase extends Model {
    static associate(models) {
      Purchase.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      Purchase.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Purchase.hasMany(models.PurchaseItem, { foreignKey: 'purchaseId', as: 'items' });
    }
  }
  Purchase.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING, unique: true },
    supplierId: DataTypes.UUID,
    userId: DataTypes.UUID,
    totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    note: DataTypes.TEXT
  }, { sequelize, modelName: 'Purchase' });
  return Purchase;
};`,

  'src/models/purchaseitem.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PurchaseItem extends Model {
    static associate(models) {
      PurchaseItem.belongsTo(models.Purchase, { foreignKey: 'purchaseId' });
      PurchaseItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    }
  }
  PurchaseItem.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    purchaseId: DataTypes.UUID,
    productId: DataTypes.UUID,
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
  }, { sequelize, modelName: 'PurchaseItem' });
  return PurchaseItem;
};`,

  'src/models/sale.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Sale extends Model {
    static associate(models) {
      Sale.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
      Sale.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Sale.hasMany(models.SaleItem, { foreignKey: 'saleId', as: 'items' });
    }
  }
  Sale.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING, unique: true },
    customerId: DataTypes.UUID,
    userId: DataTypes.UUID,
    totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    finalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'CASH' },
    note: DataTypes.TEXT
  }, { sequelize, modelName: 'Sale' });
  return Sale;
};`,

  'src/models/saleitem.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SaleItem extends Model {
    static associate(models) {
      SaleItem.belongsTo(models.Sale, { foreignKey: 'saleId' });
      SaleItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    }
  }
  SaleItem.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    saleId: DataTypes.UUID,
    productId: DataTypes.UUID,
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
  }, { sequelize, modelName: 'SaleItem' });
  return SaleItem;
};`,

  'src/models/inventorytransaction.js': `'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class InventoryTransaction extends Model {
    static associate(models) {
      InventoryTransaction.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    }
  }
  InventoryTransaction.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('IN', 'OUT', 'ADJUST'), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    referenceCode: DataTypes.STRING,
    note: DataTypes.TEXT
  }, { sequelize, modelName: 'InventoryTransaction' });
  return InventoryTransaction;
};`
};

const migrations = {
  '20261004010000-create-partners.js': `'use strict';
module.exports = {
  async up(qi, Sq) {
    await qi.createTable('Suppliers', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      name: { type: Sq.STRING, allowNull: false },
      phone: Sq.STRING, email: Sq.STRING, address: Sq.STRING,
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('Customers', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      name: { type: Sq.STRING, allowNull: false },
      phone: Sq.STRING, email: Sq.STRING, address: Sq.STRING, totalSpent: { type: Sq.DECIMAL(10, 2), defaultValue: 0 },
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
  },
  async down(qi, Sq) { await qi.dropTable('Customers'); await qi.dropTable('Suppliers'); }
};`,

  '20261004010001-create-purchases-sales-inventory.js': `'use strict';
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
};`
};

for (const [filepath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(BACKEND_DIR, filepath), content);
}
for (const [filepath, content] of Object.entries(migrations)) {
  fs.writeFileSync(path.join(BACKEND_DIR, 'migrations', filepath), content);
}
console.log('Backend scaffolding done.');
