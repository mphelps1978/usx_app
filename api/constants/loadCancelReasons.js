/** Allowed cancellation reason codes for Loads.cancelReason */

const LOAD_CANCEL_REASONS = [
  'shipper_tonu',
  'dispatch',
  'requested_cancellation',
  'insufficient_hos',
  'other',
];

const LOAD_CANCEL_REASON_LABELS = {
  shipper_tonu: 'Cancelled by Shipper (TONU)',
  dispatch: 'Cancelled by Dispatch',
  requested_cancellation: 'Requested Cancellation',
  insufficient_hos: 'Insufficient HOS Availability',
  other: 'Other (Please Specify)',
};

function isValidCancelReason(reason) {
  return LOAD_CANCEL_REASONS.includes(reason);
}

module.exports = {
  LOAD_CANCEL_REASONS,
  LOAD_CANCEL_REASON_LABELS,
  isValidCancelReason,
};
