/** Keys for UserSettings.fixedExpenses JSON (dollars per period, user-defined). */
const FIXED_EXPENSE_KEYS = [
  'leasePayment',
  'permits',
  'physicalDamageInsurance',
  'bobtailInsurance',
  'bobtailPlus',
  'occupationalAccidentalInsurance',
  'heavyVehicleUseTax',
  'satcom',
];

const DEFAULT_FIXED_EXPENSES = {
  leasePayment: 590.0,
  permits: 30.55,
  physicalDamageInsurance: 66.89,
  bobtailInsurance: 8.35,
  bobtailPlus: 7.42,
  occupationalAccidentalInsurance: 40.45,
  heavyVehicleUseTax: 10.58,
  satcom: 17.5,
};

function mergeFixedExpensesForRead(stored) {
  const base = { ...DEFAULT_FIXED_EXPENSES };
  if (!stored || typeof stored !== 'object') return base;
  for (const k of FIXED_EXPENSE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(stored, k) && stored[k] != null) {
      const n = parseFloat(stored[k]);
      if (!Number.isNaN(n)) base[k] = n;
    }
  }
  return base;
}

function normalizeFixedExpensesInput(incoming, existingStored) {
  const base = mergeFixedExpensesForRead(existingStored);
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return base;
  }
  const out = { ...base };
  for (const key of FIXED_EXPENSE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const v = incoming[key];
    if (v === null || v === '') {
      out[key] = 0;
      continue;
    }
    const n = parseFloat(v);
    if (Number.isNaN(n) || n < 0) {
      const err = new Error(`Invalid value for ${key}. Use a non-negative number.`);
      err.code = 'INVALID_FIXED_EXPENSE';
      throw err;
    }
    out[key] = n;
  }
  return out;
}

module.exports = {
  FIXED_EXPENSE_KEYS,
  DEFAULT_FIXED_EXPENSES,
  mergeFixedExpensesForRead,
  normalizeFixedExpensesInput,
};
