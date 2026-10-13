'use strict';

/**
 * Phase 1 schema fixes + columns needed by later phases:
 *  - SKU unique per user (userId, sku) instead of globally
 *  - Settings scoped per user + receipt / bank (VietQR) config
 *  - Sales: status (COMPLETED/CANCELLED), customerPaid
 *  - SaleItems: costPrice (snapshot giá vốn để tính lợi nhuận)
 *  - Money columns widened to DECIMAL(15,2) (tránh tràn khi > 100 triệu)
 */
module.exports = {
  async up(qi, Sq) {
    const t = await qi.sequelize.transaction();
    try {
      // 1. Drop every global UNIQUE constraint on Products.sku
      const [constraints] = await qi.sequelize.query(`
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'Products' AND con.contype = 'u' AND att.attname = 'sku'
          AND array_length(con.conkey, 1) = 1
      `, { transaction: t });
      for (const c of constraints) {
        await qi.sequelize.query(`ALTER TABLE "Products" DROP CONSTRAINT "${c.conname}"`, { transaction: t });
      }
      await qi.addIndex('Products', ['userId', 'sku'], {
        unique: true, name: 'products_user_sku_unique', transaction: t
      });

      // 2. Settings per user
      await qi.addColumn('Settings', 'userId', {
        type: Sq.UUID, allowNull: true, unique: true,
        references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      }, { transaction: t });
      await qi.addColumn('Settings', 'receiptFooter', { type: Sq.TEXT }, { transaction: t });
      await qi.addColumn('Settings', 'paperSize', { type: Sq.STRING, defaultValue: '80mm' }, { transaction: t });
      await qi.addColumn('Settings', 'bankBin', { type: Sq.STRING }, { transaction: t });
      await qi.addColumn('Settings', 'bankAccount', { type: Sq.STRING }, { transaction: t });
      await qi.addColumn('Settings', 'bankAccountName', { type: Sq.STRING }, { transaction: t });

      // 3. Sales status + customerPaid
      await qi.addColumn('Sales', 'status', { type: Sq.STRING, allowNull: false, defaultValue: 'COMPLETED' }, { transaction: t });
      await qi.addColumn('Sales', 'customerPaid', { type: Sq.DECIMAL(15, 2), defaultValue: 0 }, { transaction: t });

      // 4. SaleItems cost snapshot
      await qi.addColumn('SaleItems', 'costPrice', { type: Sq.DECIMAL(15, 2), defaultValue: 0 }, { transaction: t });
      await qi.sequelize.query(`
        UPDATE "SaleItems" si SET "costPrice" = p."importPrice"
        FROM "Products" p WHERE p.id = si."productId"
      `, { transaction: t });

      // 5. Widen money columns
      const money = { type: Sq.DECIMAL(15, 2), defaultValue: 0 };
      const moneyRequired = { type: Sq.DECIMAL(15, 2), allowNull: false };
      await qi.changeColumn('Products', 'importPrice', money, { transaction: t });
      await qi.changeColumn('Products', 'salePrice', money, { transaction: t });
      await qi.changeColumn('Customers', 'totalSpent', money, { transaction: t });
      await qi.changeColumn('Purchases', 'totalAmount', money, { transaction: t });
      await qi.changeColumn('PurchaseItems', 'price', moneyRequired, { transaction: t });
      await qi.changeColumn('Sales', 'totalAmount', money, { transaction: t });
      await qi.changeColumn('Sales', 'discount', money, { transaction: t });
      await qi.changeColumn('Sales', 'finalAmount', money, { transaction: t });
      await qi.changeColumn('SaleItems', 'price', moneyRequired, { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(qi, Sq) {
    await qi.removeIndex('Products', 'products_user_sku_unique');
    await qi.removeColumn('Settings', 'userId');
    await qi.removeColumn('Settings', 'receiptFooter');
    await qi.removeColumn('Settings', 'paperSize');
    await qi.removeColumn('Settings', 'bankBin');
    await qi.removeColumn('Settings', 'bankAccount');
    await qi.removeColumn('Settings', 'bankAccountName');
    await qi.removeColumn('Sales', 'status');
    await qi.removeColumn('Sales', 'customerPaid');
    await qi.removeColumn('SaleItems', 'costPrice');
  }
};
