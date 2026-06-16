export const GENERAL_FUEL_LABEL = "General fuel (no load)";

/** Sentinel for Autocomplete — not a real load row. */
export const GENERAL_FUEL_OPTION = {
	isGeneralFuel: true,
	proNumber: null,
	label: GENERAL_FUEL_LABEL,
};

export function formatFuelStopProDisplay(proNumber) {
	if (proNumber == null || proNumber === "") return GENERAL_FUEL_LABEL;
	return String(proNumber);
}
