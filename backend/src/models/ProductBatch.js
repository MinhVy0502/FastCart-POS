'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductBatch extends Model {
    static associate(models) {
      ProductBatch.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
      ProductBatch.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      ProductBatch.hasMany(models.SaleItem, { foreignKey: 'batchId', as: 'saleItems' });
    }
  }

  ProductBatch.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    batchNumber: { type: DataTypes.STRING, allowNull: false },
    manufacturingDate: { type: DataTypes.DATE, allowNull: true },
    expiryDate: { type: DataTypes.DATE, allowNull: false },
    initialQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    currentQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    note: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'ProductBatch',
    indexes: [
      { fields: ['productId', 'expiryDate'] },
      { fields: ['userId', 'expiryDate'] }
    ]
  });

  return ProductBatch;
};
