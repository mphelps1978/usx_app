/** Allow FuelStops.proNumber to be NULL (general / unlinked fuel). */

async function up(sequelize, { isSQLite }) {
  if (isSQLite) {
    const [cols] = await sequelize.query(`PRAGMA table_info("FuelStops");`);
    const proCol = cols.find((c) => c.name === 'proNumber');
    if (!proCol || proCol.notnull === 0) return;
    await sequelize.query(`ALTER TABLE "FuelStops" ALTER COLUMN "proNumber" DROP NOT NULL;`);
    return;
  }

  await sequelize.query(`
    ALTER TABLE "FuelStops" ALTER COLUMN "proNumber" DROP NOT NULL;
  `);
}

module.exports = { up };
