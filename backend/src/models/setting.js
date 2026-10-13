'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Setting extends Model {
    static associate(models) {
      Setting.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }
  Setting.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true, unique: true },
    storeName: DataTypes.STRING,
    address: DataTypes.STRING,
    phone: DataTypes.STRING,
    logoUrl: DataTypes.STRING,
    receiptFooter: DataTypes.TEXT,
    paperSize: { type: DataTypes.STRING, defaultValue: '80mm' },
    bankBin: DataTypes.STRING,
    bankAccount: DataTypes.STRING,
    bankAccountName: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Setting',
  });
  return Setting;
};