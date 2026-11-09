'use strict';

/**
 * Migration: Bổ sung quản lý công nợ Nhà cung cấp (Suppliers) và trạng thái / thanh toán cho Phiếu nhập (Purchases)
 */
module.exports = {
  async up(qi, Sq) {
    const t = await qi.sequelize.transaction();
    try {
      // 1. Thêm cột currentDebt vào bảng Suppliers
      await qi.addColumn('Suppliers', 'currentDebt', {
        type: Sq.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      }, { transaction: t });

      // 2. Thêm các cột thanh toán và trạng thái vào bảng Purchases
      await qi.addColumn('Purchases', 'paidAmount', {
        type: Sq.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      }, { transaction: t });

      await qi.addColumn('Purchases', 'paymentMethod', {
        type: Sq.STRING,
        allowNull: false,
        defaultValue: 'CASH' // 'CASH' | 'TRANSFER' | 'DEBT'
      }, { transaction: t });

      await qi.addColumn('Purchases', 'status', {
        type: Sq.STRING,
        allowNull: false,
        defaultValue: 'COMPLETED' // 'COMPLETED' | 'CANCELLED'
      }, { transaction: t });

      // Đồng bộ paidAmount = totalAmount cho các phiếu nhập cũ trước đây
      await qi.sequelize.query(
        `UPDATE "Purchases" SET "paidAmount" = "totalAmount" WHERE "paidAmount" = 0 AND "totalAmount" > 0`,
        { transaction: t }
      );

      // 3. Mở rộng bảng DebtHistories để hỗ trợ cả Khách hàng (customerId) và Nhà cung cấp (supplierId)
      await qi.changeColumn('DebtHistories', 'customerId', {
        type: Sq.UUID,
        allowNull: true,
        references: {
          model: 'Customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction: t });

      await qi.addColumn('DebtHistories', 'supplierId', {
        type: Sq.UUID,
        allowNull: true,
        references: {
          model: 'Suppliers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction: t });

      await qi.addIndex('DebtHistories', ['supplierId', 'createdAt'], {
        name: 'debt_histories_supplier_created_idx',
        transaction: t
      });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(qi, Sq) {
    const t = await qi.sequelize.transaction();
    try {
      await qi.removeIndex('DebtHistories', 'debt_histories_supplier_created_idx', { transaction: t });
      await qi.removeColumn('DebtHistories', 'supplierId', { transaction: t });

      // Xóa các bản ghi nợ của NCC trước khi đặt lại customerId NOT NULL
      await qi.sequelize.query(`DELETE FROM "DebtHistories" WHERE "customerId" IS NULL`, { transaction: t });

      await qi.changeColumn('DebtHistories', 'customerId', {
        type: Sq.UUID,
        allowNull: false,
        references: {
          model: 'Customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction: t });

      await qi.removeColumn('Purchases', 'status', { transaction: t });
      await qi.removeColumn('Purchases', 'paymentMethod', { transaction: t });
      await qi.removeColumn('Purchases', 'paidAmount', { transaction: t });
      await qi.removeColumn('Suppliers', 'currentDebt', { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};

