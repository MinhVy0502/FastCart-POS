'use strict';

/**
 * Migration: Bổ sung barcode, unit và supplierId vào bảng Products
 */
module.exports = {
  async up(qi, Sq) {
    const t = await qi.sequelize.transaction();
    try {
      // 1. Thêm cột barcode
      await qi.addColumn('Products', 'barcode', {
        type: Sq.STRING,
        allowNull: true
      }, { transaction: t });

      // 2. Thêm cột unit (Đơn vị tính)
      await qi.addColumn('Products', 'unit', {
        type: Sq.STRING,
        allowNull: true,
        defaultValue: 'Cái'
      }, { transaction: t });

      // 3. Thêm cột supplierId (Nhà cung cấp ưu tiên)
      await qi.addColumn('Products', 'supplierId', {
        type: Sq.UUID,
        allowNull: true,
        references: {
          model: 'Suppliers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });

      // 4. Tạo index cho userId + barcode
      await qi.addIndex('Products', ['userId', 'barcode'], {
        name: 'products_user_barcode_idx',
        transaction: t
      });

      // 5. Tạo index cho userId + supplierId
      await qi.addIndex('Products', ['userId', 'supplierId'], {
        name: 'products_user_supplier_idx',
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
      await qi.removeIndex('Products', 'products_user_supplier_idx', { transaction: t });
      await qi.removeIndex('Products', 'products_user_barcode_idx', { transaction: t });
      await qi.removeColumn('Products', 'supplierId', { transaction: t });
      await qi.removeColumn('Products', 'unit', { transaction: t });
      await qi.removeColumn('Products', 'barcode', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
