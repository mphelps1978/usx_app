/** Format date strings to YYYY-MM-DD for HTML date inputs */
export function formatDateForInput(dateString) {
	if (!dateString) return "";
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			const parts = String(dateString).split("T")[0].split("-");
			if (parts.length === 3) {
				const year = parseInt(parts[0], 10);
				const month = parseInt(parts[1], 10) - 1;
				const day = parseInt(parts[2], 10);
				const utcDate = new Date(Date.UTC(year, month, day));
				if (!isNaN(utcDate.getTime())) {
					return utcDate.toISOString().split("T")[0];
				}
			}
			return "";
		}
		return date.toISOString().split("T")[0];
	} catch (e) {
		return "";
	}
}

/** Parse odometer input; empty → null */
export function parseOdometerField(val) {
	if (val === undefined || val === null || String(val).trim() === "") return null;
	const n = parseFloat(val);
	return Number.isNaN(n) ? null : n;
}

/** Server-aligned: three readings → deadhead / loaded / total miles, or nulls if incomplete/invalid order */
export function computeClientOdometerDerived(
	startingOdometer,
	loadedStartOdometer,
	endingOdometer
) {
	const s = parseOdometerField(startingOdometer);
	const l = parseOdometerField(loadedStartOdometer);
	const e = parseOdometerField(endingOdometer);
	if (s === null || l === null || e === null) {
		return {
			actualDeadheadMiles: null,
			actualLoadedMiles: null,
			actualMiles: null,
			invalidOrder: false,
		};
	}
	if (!(s < l && l < e)) {
		return {
			actualDeadheadMiles: null,
			actualLoadedMiles: null,
			actualMiles: null,
			invalidOrder: true,
		};
	}
	return {
		actualDeadheadMiles: l - s,
		actualLoadedMiles: e - l,
		actualMiles: e - s,
		invalidOrder: false,
	};
}

export const US_STATES = [
	"AL",
	"AK",
	"AZ",
	"AR",
	"CA",
	"CO",
	"CT",
	"DE",
	"FL",
	"GA",
	"HI",
	"ID",
	"IL",
	"IN",
	"IA",
	"KS",
	"KY",
	"LA",
	"ME",
	"MD",
	"MA",
	"MI",
	"MN",
	"MS",
	"MO",
	"MT",
	"NE",
	"NV",
	"NH",
	"NJ",
	"NM",
	"NY",
	"NC",
	"ND",
	"OH",
	"OK",
	"OR",
	"PA",
	"RI",
	"SC",
	"SD",
	"TN",
	"TX",
	"UT",
	"VT",
	"VA",
	"WA",
	"WV",
	"WI",
	"WY",
];
