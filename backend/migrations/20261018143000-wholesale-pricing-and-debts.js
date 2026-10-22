'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // 1. Thêm cột wholesalePrice (Giá bán sỉ) vào bảng Products
      await queryInterface.addColumn('Products', 'wholesalePrice', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      }, { transaction: t });

      // 2. Thêm các cột phân loại và công nợ vào bảng Customers
      await queryInterface.addColumn('Customers', 'customerType', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'RETAIL' // 'RETAIL' (Khách lẻ) | 'WHOLESALE' (Đại lý / Tiệm tạp hóa)
      }, { transaction: t });

      await queryInterface.addColumn('Customers', 'storeName', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('Customers', 'currentDebt', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      }, { transaction: t });

      await queryInterface.addColumn('Customers', 'debtLimit', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      }, { transaction: t });

      // 3. Tạo bảng DebtHistories (Lịch sử biến động công nợ)
      await queryInterface.createTable('DebtHistories', {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4
        },
        customerId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Customers',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false // 'INCREASE' (Mua nợ) | 'DECREASE' (Trả nợ / Thu nợ)
        },
        amount: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        balanceBefore: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        balanceAfter: {
          type: Sequelize.DECIMAL(15, 2),
          allowNull: false,
          defaultValue: 0
        },
        referenceCode: {
          type: Sequelize.STRING,
          allowNull: true // HD... hoặc PT...
        },
        paymentMethod: {
          type: Sequelize.STRING,
          allowNull: true // 'CASH', 'TRANSFER'
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      }, { transaction: t });

      // 4. Tạo Index cho DebtHistories
      await queryInterface.addIndex('DebtHistories', ['customerId', 'createdAt'], {
        name: 'debt_histories_customer_created_idx',
        transaction: t
      });

      await queryInterface.addIndex('DebtHistories', ['userId', 'createdAt'], {
        name: 'debt_histories_user_created_idx',
        transaction: t
      });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('DebtHistories', { transaction: t });
      await queryInterface.removeColumn('Customers', 'debtLimit', { transaction: t });
      await queryInterface.removeColumn('Customers', 'currentDebt', { transaction: t });
      await queryInterface.removeColumn('Customers', 'storeName', { transaction: t });
      await queryInterface.removeColumn('Customers', 'customerType', { transaction: t });
      await queryInterface.removeColumn('Products', 'wholesalePrice', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
