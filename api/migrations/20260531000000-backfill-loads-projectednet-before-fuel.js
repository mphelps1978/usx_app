/** Recalculate Loads.projectedNet without fuel (gross − deductions − scale). */

async function up(sequelize, { isSQLite }) {
  const deductionExpr =
    'COALESCE("totalDeductions", COALESCE("fuelRoadUseTax",0)+COALESCE("maintenanceReserve",0)+COALESCE("bondDeposit",0)+COALESCE("mrpFee",0))';

  const roundExpr = isSQLite
    ? `ROUND(COALESCE("calculatedGross",0) - (${deductionExpr}) - COALESCE("scaleCost",0), 2)`
    : `ROUND((COALESCE("calculatedGross",0) - (${deductionExpr}) - COALESCE("scaleCost",0))::numeric, 2)`;

  const cancelledFilter = isSQLite
    ? 'COALESCE("isCancelled", 0) = 0'
    : 'COALESCE("isCancelled", false) = false';

  await sequelize.query(`
    UPDATE "Loads"
    SET "projectedNet" = ${roundExpr}
    WHERE ${cancelledFilter};
  `);
}

module.exports = { up };
