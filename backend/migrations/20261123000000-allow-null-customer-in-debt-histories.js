'use strict';

/**
 * Fix PostgreSQL NOT NULL constraint on DebtHistories.customerId
 * so DebtHistory records for Suppliers (customerId = null) succeed cleanly.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "DebtHistories" ALTER COLUMN "customerId" DROP NOT NULL;'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DELETE FROM "DebtHistories" WHERE "customerId" IS NULL;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "DebtHistories" ALTER COLUMN "customerId" SET NOT NULL;'
    );
  }
};
