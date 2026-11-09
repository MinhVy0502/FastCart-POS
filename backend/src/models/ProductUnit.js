'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductUnit extends Model {
    static associate(models) {
      ProductUnit.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
      ProductUnit.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  ProductUnit.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    unitName: { type: DataTypes.STRING, allowNull: false },
    conversionFactor: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    barcode: { type: DataTypes.STRING, allowNull: true },
    salePrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    wholesalePrice: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    isDefault: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    sequelize,
    modelName: 'ProductUnit',
    indexes: [
      { fields: ['productId'] },
      { fields: ['userId', 'barcode'] }
    ]
  });

  return ProductUnit;
};
