'use strict';

/**
 * Migration: Bổ sung Quy đổi Đơn vị tính (ProductUnits) và Quản lý Lô / Hạn sử dụng (ProductBatches)
 */
module.exports = {
  async up(qi, Sq) {
    const t = await qi.sequelize.transaction();
    try {
      // 1. Tạo bảng ProductUnits (Đơn vị tính phụ / quy đổi: Thùng, Lốc, Hộp...)
      await qi.createTable('ProductUnits', {
        id: {
          type: Sq.UUID,
          defaultValue: Sq.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        productId: {
          type: Sq.UUID,
          allowNull: false,
          references: {
            model: 'Products',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        userId: {
          type: Sq.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        unitName: {
          type: Sq.STRING,
          allowNull: false
        },
        conversionFactor: {
          type: Sq.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        barcode: {
          type: Sq.STRING,
          allowNull: true
        },
        salePrice: {
          type: Sq.DECIMAL(15, 2),
          defaultValue: 0
        },
        wholesalePrice: {
          type: Sq.DECIMAL(15, 2),
          defaultValue: 0
        },
        isDefault: {
          type: Sq.BOOLEAN,
          defaultValue: false
        },
        createdAt: {
          type: Sq.DATE,
          allowNull: false,
          defaultValue: Sq.fn('NOW')
        },
        updatedAt: {
          type: Sq.DATE,
          allowNull: false,
          defaultValue: Sq.fn('NOW')
        }
      }, { transaction: t });

      // 2. Tạo bảng ProductBatches (Lô hàng & Hạn sử dụng)
      await qi.createTable('ProductBatches', {
        id: {
          type: Sq.UUID,
          defaultValue: Sq.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        productId: {
          type: Sq.UUID,
          allowNull: false,
          references: {
            model: 'Products',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        userId: {
          type: Sq.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        batchNumber: {
          type: Sq.STRING,
          allowNull: false
        },
        manufacturingDate: {
          type: Sq.DATE,
          allowNull: true
        },
        expiryDate: {
          type: Sq.DATE,
          allowNull: false
        },
        initialQuantity: {
          type: Sq.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        currentQuantity: {
          type: Sq.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        note: {
          type: Sq.TEXT,
          allowNull: true
        },
        createdAt: {
          type: Sq.DATE,
          allowNull: false,
          defaultValue: Sq.fn('NOW')
        },
        updatedAt: {
          type: Sq.DATE,
          allowNull: false,
          defaultValue: Sq.fn('NOW')
        }
      }, { transaction: t });

      // 3. Bổ sung cấu hình HSD vào bảng Products
      await qi.addColumn('Products', 'hasExpiryDate', {
        type: Sq.BOOLEAN,
        defaultValue: false
      }, { transaction: t });

      await qi.addColumn('Products', 'expiryWarningDays', {
        type: Sq.INTEGER,
        defaultValue: 30
      }, { transaction: t });

      // 4. Bổ sung thông tin đơn vị bán & lô hàng vào SaleItems
      await qi.addColumn('SaleItems', 'unitName', {
        type: Sq.STRING,
        allowNull: true
      }, { transaction: t });

      await qi.addColumn('SaleItems', 'conversionFactor', {
        type: Sq.INTEGER,
        defaultValue: 1
      }, { transaction: t });

      await qi.addColumn('SaleItems', 'batchId', {
        type: Sq.UUID,
        allowNull: true,
        references: {
          model: 'ProductBatches',
          key: 'id'
        },
        onDelete: 'SET NULL'
      }, { transaction: t });

      // 5. Bổ sung thông tin đơn vị nhập & lô hàng vào PurchaseItems
      await qi.addColumn('PurchaseItems', 'unitName', {
        type: Sq.STRING,
        allowNull: true
      }, { transaction: t });

      await qi.addColumn('PurchaseItems', 'conversionFactor', {
        type: Sq.INTEGER,
        defaultValue: 1
      }, { transaction: t });

      await qi.addColumn('PurchaseItems', 'batchNumber', {
        type: Sq.STRING,
        allowNull: true
      }, { transaction: t });

      await qi.addColumn('PurchaseItems', 'expiryDate', {
        type: Sq.DATE,
        allowNull: true
      }, { transaction: t });

      await qi.addColumn('PurchaseItems', 'manufacturingDate', {
        type: Sq.DATE,
        allowNull: true
      }, { transaction: t });

      // 6. Tạo index
      await qi.addIndex('ProductUnits', ['productId'], {
        name: 'product_units_product_idx',
        transaction: t
      });

      await qi.addIndex('ProductUnits', ['userId', 'barcode'], {
        name: 'product_units_user_barcode_idx',
        transaction: t
      });

      await qi.addIndex('ProductBatches', ['productId', 'expiryDate'], {
        name: 'product_batches_product_expiry_idx',
        transaction: t
      });

      await qi.addIndex('ProductBatches', ['userId', 'expiryDate'], {
        name: 'product_batches_user_expiry_idx',
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
      await qi.removeIndex('ProductBatches', 'product_batches_user_expiry_idx', { transaction: t });
      await qi.removeIndex('ProductBatches', 'product_batches_product_expiry_idx', { transaction: t });
      await qi.removeIndex('ProductUnits', 'product_units_user_barcode_idx', { transaction: t });
      await qi.removeIndex('ProductUnits', 'product_units_product_idx', { transaction: t });

      await qi.removeColumn('PurchaseItems', 'manufacturingDate', { transaction: t });
      await qi.removeColumn('PurchaseItems', 'expiryDate', { transaction: t });
      await qi.removeColumn('PurchaseItems', 'batchNumber', { transaction: t });
      await qi.removeColumn('PurchaseItems', 'conversionFactor', { transaction: t });
      await qi.removeColumn('PurchaseItems', 'unitName', { transaction: t });

      await qi.removeColumn('SaleItems', 'batchId', { transaction: t });
      await qi.removeColumn('SaleItems', 'conversionFactor', { transaction: t });
      await qi.removeColumn('SaleItems', 'unitName', { transaction: t });

      await qi.removeColumn('Products', 'expiryWarningDays', { transaction: t });
      await qi.removeColumn('Products', 'hasExpiryDate', { transaction: t });

      await qi.dropTable('ProductBatches', { transaction: t });
      await qi.dropTable('ProductUnits', { transaction: t });

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
};
