/** Load revenue before fuel: gross − deductions − scale. */

export function getLoadDeductions(load) {
	if (!load) return 0;
	const total = parseFloat(load.totalDeductions);
	if (!Number.isNaN(total) && load.totalDeductions != null) {
		return total;
	}
	return (
		(parseFloat(load.fuelRoadUseTax) || 0) +
		(parseFloat(load.maintenanceReserve) || 0) +
		(parseFloat(load.bondDeposit) || 0) +
		(parseFloat(load.mrpFee) || 0)
	);
}

export function getLoadRevenueBeforeFuel(load) {
	if (!load || load.isCancelled) return 0;
	const gross = parseFloat(load.calculatedGross) || 0;
	const deductions = getLoadDeductions(load);
	const scale = parseFloat(load.scaleCost) || 0;
	return Math.round((gross - deductions - scale) * 100) / 100;
}
