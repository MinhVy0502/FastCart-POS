'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.hasMany(models.Purchase, { foreignKey: 'supplierId' });
      Supplier.hasMany(models.Product, { foreignKey: 'supplierId', as: 'products' });
      Supplier.hasMany(models.DebtHistory, { foreignKey: 'supplierId', as: 'debtHistories' });
    }
  }
  Supplier.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    currentDebt: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: true }
  }, { sequelize, modelName: 'Supplier' });
  return Supplier;
};