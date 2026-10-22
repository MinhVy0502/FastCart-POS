'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DebtHistory extends Model {
    static associate(models) {
      DebtHistory.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
      DebtHistory.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  DebtHistory.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customerId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false }, // 'INCREASE' | 'DECREASE'
    amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    balanceBefore: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    balanceAfter: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    referenceCode: DataTypes.STRING,
    paymentMethod: DataTypes.STRING,
    note: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'DebtHistory'
  });

  return DebtHistory;
};
