'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // We add userId to Categories, Products, Customers, Suppliers
    await queryInterface.addColumn('Categories', 'userId', {
      type: Sequelize.UUID,
      allowNull: true, // true initially to avoid breaking existing rows
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('Products', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('Customers', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addColumn('Suppliers', 'userId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Categories', 'userId');
    await queryInterface.removeColumn('Products', 'userId');
    await queryInterface.removeColumn('Customers', 'userId');
    await queryInterface.removeColumn('Suppliers', 'userId');
  }
};
