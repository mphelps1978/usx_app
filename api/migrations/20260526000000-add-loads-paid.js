/** Add Loads.isPaid and Loads.paidAt (Postgres + SQLite). */

async function up(sequelize, { isSQLite }) {
  if (isSQLite) {
    const [cols] = await sequelize.query(`PRAGMA table_info("Loads");`);
    const names = cols.map((c) => c.name);
    if (!names.includes('isPaid')) {
      await sequelize.query(
        `ALTER TABLE "Loads" ADD COLUMN "isPaid" INTEGER NOT NULL DEFAULT 0;`,
      );
    }
    if (!names.includes('paidAt')) {
      await sequelize.query(`ALTER TABLE "Loads" ADD COLUMN "paidAt" DATE;`);
    }
    return;
  }

  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
  `);
  await sequelize.query(`
    ALTER TABLE "Loads" ADD COLUMN IF NOT EXISTS "paidAt" DATE;
  `);
}

module.exports = { up };
