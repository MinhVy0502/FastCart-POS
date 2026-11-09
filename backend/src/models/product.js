'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
      Product.belongsTo(models.Shelf, { foreignKey: 'shelfId', as: 'shelf' });
      Product.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      Product.hasMany(models.InventoryTransaction, { foreignKey: 'productId', as: 'transactions' });
      Product.hasMany(models.ProductUnit, { foreignKey: 'productId', as: 'units', onDelete: 'CASCADE' });
      Product.hasMany(models.ProductBatch, { foreignKey: 'productId', as: 'batches', onDelete: 'CASCADE' });
    }
  }
  Product.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sku: { type: DataTypes.STRING, allowNull: false },
    barcode: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
    unit: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Cái' },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    shelfId: { type: DataTypes.UUID, allowNull: true },
    supplierId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    importPrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    salePrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    wholesalePrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    currentStock: { type: DataTypes.INTEGER, defaultValue: 0 },
    minStock: { type: DataTypes.INTEGER, defaultValue: 10 },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    hasExpiryDate: { type: DataTypes.BOOLEAN, defaultValue: false },
    expiryWarningDays: { type: DataTypes.INTEGER, defaultValue: 30 }
  }, {
    sequelize,
    modelName: 'Product',
    indexes: [
      { unique: true, fields: ['userId', 'sku'], name: 'products_user_sku_unique' },
      { fields: ['userId', 'barcode'], name: 'products_user_barcode_idx' },
      { fields: ['userId', 'supplierId'], name: 'products_user_supplier_idx' }
    ]
  });
  return Product;
};
