'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
      Product.belongsTo(models.Shelf, { foreignKey: 'shelfId', as: 'shelf' });
    }
  }
  Product.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sku: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    shelfId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    importPrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    salePrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    currentStock: { type: DataTypes.INTEGER, defaultValue: 0 },
    minStock: { type: DataTypes.INTEGER, defaultValue: 10 },
    imageUrl: { type: DataTypes.STRING, allowNull: true }
  }, {
    sequelize,
    modelName: 'Product',
    indexes: [{ unique: true, fields: ['userId', 'sku'], name: 'products_user_sku_unique' }]
  });
  return Product;
};
