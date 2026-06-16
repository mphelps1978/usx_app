export const LOAD_CANCEL_REASONS = [
	{ value: "shipper_tonu", label: "Cancelled by Shipper (TONU)" },
	{ value: "dispatch", label: "Cancelled by Dispatch" },
	{ value: "requested_cancellation", label: "Requested Cancellation" },
	{ value: "insufficient_hos", label: "Insufficient HOS Availability" },
	{ value: "other", label: "Other (Please Specify)" },
];

export function getCancelReasonLabel(load) {
	if (!load?.isCancelled) return null;
	if (load.cancelReason === "other" && load.cancelReasonOther) {
		return `Other: ${load.cancelReasonOther}`;
	}
	const match = LOAD_CANCEL_REASONS.find((r) => r.value === load.cancelReason);
	return match?.label ?? load.cancelReason ?? "Cancelled";
}

/** In transit and not cancelled — counts as the one active load slot. */
export function isActiveLoad(load) {
	return load && !load.dateDelivered && !load.isCancelled;
}

/** Included in settlement / net revenue projections. */
export function countsTowardReconciliation(load) {
	return load && !load.isCancelled;
}
