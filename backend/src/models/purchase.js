'use strict';
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
    totalAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    note: DataTypes.TEXT
  }, { sequelize, modelName: 'Purchase' });
  return Purchase;
};