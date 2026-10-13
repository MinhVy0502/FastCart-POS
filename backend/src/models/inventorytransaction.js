'use strict';
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
};