/**
 * Allowed categories for office / receipt expenses (business; not meals—those go under per diem).
 * `value` is stored in the database; `label` is for display.
 */
const OFFICE_EXPENSE_CATEGORIES = [
  { value: 'office_supplies', label: 'Office supplies' },
  { value: 'truck_supplies', label: 'Truck supplies' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'tools', label: 'Tools' },
  { value: 'professional_services', label: 'Professional services' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'communications', label: 'Communications & connectivity' },
  { value: 'other', label: 'Other' },
];

const ALLOWED_OFFICE_EXPENSE_CATEGORY_VALUES = new Set(
  OFFICE_EXPENSE_CATEGORIES.map((c) => c.value)
);

module.exports = {
  OFFICE_EXPENSE_CATEGORIES,
  ALLOWED_OFFICE_EXPENSE_CATEGORY_VALUES,
};
