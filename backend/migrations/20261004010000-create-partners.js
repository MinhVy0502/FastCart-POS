'use strict';
module.exports = {
  async up(qi, Sq) {
    await qi.createTable('Suppliers', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      name: { type: Sq.STRING, allowNull: false },
      phone: Sq.STRING, email: Sq.STRING, address: Sq.STRING,
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
    await qi.createTable('Customers', {
      id: { allowNull: false, primaryKey: true, type: Sq.UUID, defaultValue: Sq.UUIDV4 },
      name: { type: Sq.STRING, allowNull: false },
      phone: Sq.STRING, email: Sq.STRING, address: Sq.STRING, totalSpent: { type: Sq.DECIMAL(10, 2), defaultValue: 0 },
      createdAt: { allowNull: false, type: Sq.DATE }, updatedAt: { allowNull: false, type: Sq.DATE }
    });
  },
  async down(qi, Sq) { await qi.dropTable('Customers'); await qi.dropTable('Suppliers'); }
};