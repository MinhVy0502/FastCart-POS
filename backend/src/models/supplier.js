'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model { static associate(models) { Supplier.hasMany(models.Purchase, { foreignKey: 'supplierId' }); } }
  Supplier.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    phone: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    userId: { type: DataTypes.UUID, allowNull: true }
  }, { sequelize, modelName: 'Supplier' });
  return Supplier;
};