'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SaleItem extends Model {
    static associate(models) {
      SaleItem.belongsTo(models.Sale, { foreignKey: 'saleId', as: 'sale' });
      SaleItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
      SaleItem.belongsTo(models.ProductBatch, { foreignKey: 'batchId', as: 'batch' });
    }
  }
  SaleItem.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    saleId: DataTypes.UUID,
    productId: DataTypes.UUID,
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    price: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    costPrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    unitName: { type: DataTypes.STRING, allowNull: true },
    conversionFactor: { type: DataTypes.INTEGER, defaultValue: 1 },
    batchId: { type: DataTypes.UUID, allowNull: true }
  }, { sequelize, modelName: 'SaleItem' });
  return SaleItem;
};