'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Customer extends Model { static associate(models) { Customer.hasMany(models.Sale, { foreignKey: 'customerId' }); } }
  Customer.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    totalSpent: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    userId: { type: DataTypes.UUID, allowNull: true }
  }, { sequelize, modelName: 'Customer' });
  return Customer;
};