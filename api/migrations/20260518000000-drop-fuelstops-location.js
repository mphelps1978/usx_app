/** Drop unused FuelStops.location (Postgres + SQLite). */

async function up(sequelize, { isSQLite }) {
  if (isSQLite) {
    const [cols] = await sequelize.query(`PRAGMA table_info("FuelStops");`);
    const hasLocation = cols.some((c) => c.name === 'location');
    if (!hasLocation) return;
    await sequelize.query(`ALTER TABLE "FuelStops" DROP COLUMN "location";`);
    return;
  }

  await sequelize.query(`ALTER TABLE "FuelStops" DROP COLUMN IF EXISTS "location";`);
}

module.exports = { up };
