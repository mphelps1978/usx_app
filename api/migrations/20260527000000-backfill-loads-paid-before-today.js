/** One-time: mark delivered loads before today UTC as paid (paidAt = dateDelivered). */

function affectedRows(queryResult) {
  const meta = queryResult[1];
  if (!meta) return 0;
  if (typeof meta.rowCount === 'number') return meta.rowCount;
  if (typeof meta.changes === 'number') return meta.changes;
  return 0;
}

async function up(sequelize, { isSQLite }) {
  if (isSQLite) {
    const [cols] = await sequelize.query(`PRAGMA table_info("Loads");`);
    const names = cols.map((c) => c.name);
    if (!names.includes('isPaid')) {
      console.warn('[MIGRATE] Skipping paid backfill — isPaid column missing');
      return;
    }

    const result = await sequelize.query(`
      UPDATE "Loads"
      SET "isPaid" = 1,
          "paidAt" = COALESCE("paidAt", "dateDelivered")
      WHERE "dateDelivered" IS NOT NULL
        AND "dateDelivered" < date('now')
        AND "isPaid" = 0;
    `);
    const n = affectedRows(result);
    console.log(`[MIGRATE] Backfilled ${n} loads as paid (delivered before today)`);
    return;
  }

  const result = await sequelize.query(`
    UPDATE "Loads"
    SET "isPaid" = true,
        "paidAt" = COALESCE("paidAt", "dateDelivered")
    WHERE "dateDelivered" IS NOT NULL
      AND "dateDelivered" < CURRENT_DATE
      AND "isPaid" = false;
  `);
  const n = affectedRows(result);
  console.log(`[MIGRATE] Backfilled ${n} loads as paid (delivered before today)`);
}

module.exports = { up };
