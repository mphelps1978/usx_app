/** Add Loads cancellation fields (Postgres + SQLite). */

async function up(sequelize, { isSQLite }) {
  if (isSQLite) {
    const [cols] = await sequelize.query(`PRAGMA table_info("Loads");`);
    const names = cols.map((c) => c.name);
    if (!names.includes('isCancelled')) {
      await sequelize.query(
        `ALTER TABLE "Loads" ADD COLUMN "isCancelled" INTEGER NOT NULL DEFAULT 0;`,
      );
    }
    if (!names.includes('cancelReason')) {
      await sequelize.query(`ALTER TABLE "Loads" ADD COLUMN "cancelReason" TEXT;`);
    }
    if (!names.includes('cancelReasonOther')) {
      await sequelize.query(`ALTER TABLE "Loads" ADD COLUMN "cancelReasonOther" TEXT;`);
    }
    if (!names.includes('cancelledAt')) {
      await sequelize.query(`ALTER TABLE "Loads" ADD COLUMN "cancelledAt" DATE;`);
    }
    return;
  }

  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "isCancelled" BOOLEAN NOT NULL DEFAULT false;
  `);
  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "cancelReason" VARCHAR(255);
  `);
  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "cancelReasonOther" TEXT;
  `);
  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "cancelledAt" DATE;
  `);
}

module.exports = { up };
