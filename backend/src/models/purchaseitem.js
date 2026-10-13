'use strict';
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
    price: { type: DataTypes.DECIMAL(15, 2), allowNull: false }
  }, { sequelize, modelName: 'PurchaseItem' });
  return PurchaseItem;
};