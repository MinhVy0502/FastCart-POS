'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Customer extends Model {
    static associate(models) {
      Customer.hasMany(models.Sale, { foreignKey: 'customerId', as: 'sales' });
      Customer.hasMany(models.DebtHistory, { foreignKey: 'customerId', as: 'debts' });
    }
  }
  Customer.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    customerType: { type: DataTypes.STRING, defaultValue: 'RETAIL' }, // 'RETAIL' | 'WHOLESALE'
    storeName: DataTypes.STRING,
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    totalSpent: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    currentDebt: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    debtLimit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: true }
  }, { sequelize, modelName: 'Customer' });
  return Customer;
};