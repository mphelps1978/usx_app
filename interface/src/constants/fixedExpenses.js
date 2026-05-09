/** Keys and labels for per-user fixed weekly/monthly-style expenses (stored in UserSettings.fixedExpenses). */
export const FIXED_EXPENSE_FIELDS = [
	{ key: "leasePayment", label: "Lease Payment" },
	{ key: "permits", label: "Permits" },
	{ key: "physicalDamageInsurance", label: "Physical Damage Insurance" },
	{ key: "bobtailInsurance", label: "Bobtail Insurance" },
	{ key: "bobtailPlus", label: "Bobtail Plus" },
	{
		key: "occupationalAccidentalInsurance",
		label: "Occupational Accidental Insurance",
	},
	{ key: "heavyVehicleUseTax", label: "Heavy Vehicle Use Tax" },
	{ key: "satcom", label: "Satcom" },
];

/** Suggested defaults when the user has never saved (UI + API merge). */
export const DEFAULT_FIXED_EXPENSE_AMOUNTS = {
	leasePayment: 590.0,
	permits: 30.55,
	physicalDamageInsurance: 66.89,
	bobtailInsurance: 8.35,
	bobtailPlus: 7.42,
	occupationalAccidentalInsurance: 40.45,
	heavyVehicleUseTax: 10.58,
	satcom: 17.5,
};
