'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Shelf extends Model {
    static associate(models) {
      Shelf.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      Shelf.hasMany(models.Product, { foreignKey: 'shelfId', as: 'products' });
    }
  }

  Shelf.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Shelf',
    tableName: 'Shelves'
  });

  return Shelf;
};
