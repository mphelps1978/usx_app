/**
 * Keep in sync with usx_app/api/constants/officeExpenseCategories.js
 */
export const OFFICE_EXPENSE_CATEGORIES = [
	{ value: "office_supplies", label: "Office supplies" },
	{ value: "truck_supplies", label: "Truck supplies" },
	{ value: "maintenance", label: "Maintenance" },
	{ value: "tools", label: "Tools" },
	{ value: "professional_services", label: "Professional services" },
	{ value: "subscriptions", label: "Subscriptions" },
	{ value: "communications", label: "Communications & connectivity" },
	{ value: "other", label: "Other" },
];

export const DEFAULT_OFFICE_EXPENSE_CATEGORY = "office_supplies";

const LABEL_BY_VALUE = Object.fromEntries(
	OFFICE_EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

/** Removed from the dropdown; still shown for older saved rows. */
const LEGACY_CATEGORY_LABELS = {
	licenses_permits: "Licenses & permits",
	insurance_business: "Insurance (business)",
	uniforms_safety: "Uniforms & safety equipment",
};

export function officeExpenseCategoryLabel(value) {
	if (value == null) return "—";
	return (
		LABEL_BY_VALUE[value] || LEGACY_CATEGORY_LABELS[value] || value
	);
}
