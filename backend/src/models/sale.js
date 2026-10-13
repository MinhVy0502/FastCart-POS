'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Sale extends Model {
    static associate(models) {
      Sale.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
      Sale.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Sale.hasMany(models.SaleItem, { foreignKey: 'saleId', as: 'items' });
    }
  }
  Sale.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    code: { type: DataTypes.STRING, unique: true },
    customerId: DataTypes.UUID,
    userId: DataTypes.UUID,
    totalAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    finalAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    customerPaid: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'CASH' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'COMPLETED' },
    note: DataTypes.TEXT
  }, { sequelize, modelName: 'Sale' });
  return Sale;
};