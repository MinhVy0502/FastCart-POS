'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      sku: { type: Sequelize.STRING, unique: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      categoryId: {
        type: Sequelize.UUID,
        references: { model: 'Categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      importPrice: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      salePrice: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      currentStock: { type: Sequelize.INTEGER, defaultValue: 0 },
      minStock: { type: Sequelize.INTEGER, defaultValue: 10 },
      imageUrl: { type: Sequelize.STRING },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Products');
  }
};
