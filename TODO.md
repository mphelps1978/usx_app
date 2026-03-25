# USX IC Books — TODO

---

## 1. Settlement Resolver

**Goal:** Allow the user to reconcile their weekly company settlement report against app data.

### Settings — Standard Deductions Tab
- Add a new tab to the Settings modal for "Settlement Deductions"
- Store the following in the DB (per user, like existing UserSettings):
  - Occupational Accident Insurance (weekly flat amount)
  - Physical Damage Insurance (weekly flat amount)
  - Bobtail/Non-Trucking Liability Insurance (weekly flat amount)
  - Any other recurring flat deductions the user configures (name + amount)
- These are deducted every settlement regardless of load count

### Settlements Page
- Select a settlement period (date range, typically weekly)
- Auto-populate loads by PRO number that fall within the period
- Option to manually add loads not auto-detected (late deliveries, etc.)
- Pull in fuel stop costs for those loads
- **Deductions section:**
  - Standard deductions (from Settings — pulled automatically)
  - Per-mile deductions already stored on loads (MRP, bond, maintenance, fuel road use)
  - Maintenance/repair costs entered in app (future — see item #2)
  - Manual deductions (Advances, chargebacks, etc.) — user-entered, labeled
- **Additions section:**
  - Adjustments/bonuses (training pay, reimbursements, etc.) — user-entered, labeled
- **Output:**
  - Gross pay (sum of load calculatedGross for the period)
  - Total deductions (standard + per-mile + repairs + manual)
  - Total additions
  - Projected net settlement
  - Option to mark settlement as "reconciled" once verified against actual deposit

---

## 2. Maintenance & Repairs System

- New DB model: `MaintenanceRepairs` (userId, date, description, cost, category, loadProNumber?)
- New page/component: Maintenance & Repairs
- Categories: Tires, Engine, Brakes, Preventive, Other
- Feeds into Settlement deductions (see item #1)
- Feeds into future tax/expense reporting (see item #8 backlog)

---

## 3. Other Expenses

- New DB model: `OtherExpenses` (userId, date, description, amount, category)
- Categories: Scales, Tolls, Permits, Lumpers, Miscellaneous
- Feeds into Settlement and tax reporting

---

## 4. Odometer Tracking on Loads

**Goal:** Track actual miles driven per load (both deadhead and loaded) for tax deduction purposes.

### DB — fields that already exist
- `startingOdometer` — reading at time of dispatch (before deadhead begins)
- `endingOdometer` — reading at time of delivery
- `actualMiles` — currently mirrors loadedMiles; should be computed from odometer diff

### New fields needed on the Loads model
- `loadedStartOdometer` — odometer at pickup (after deadhead, before loaded miles)
- Actual deadhead miles = loadedStartOdometer − startingOdometer
- Actual loaded miles = endingOdometer − loadedStartOdometer
- Actual total miles = endingOdometer − startingOdometer

### UI changes
- **Dispatch modal:** add "Starting Odometer" field (required)
- **Complete Load modal (see item #5):** add "Loaded Start Odometer" and "Ending Odometer" fields
- Compute and save actual deadhead miles, actual loaded miles, actual total miles on completion
- No display needed yet — just capture and store for future tax reporting

### Tax use case
- Deadhead miles = unpaid miles = deductible business expense
- Will feed into future Tax Summary page (backlog)

---

## 5. Complete Load — Delivery Popup (Dashboard)

**Goal:** When marking a load as delivered from the dashboard, show a financial summary modal before confirming.

### Modal contents
- Load PRO number, origin → destination, total miles paid
- Rate per mile (calculatedGross / totalMiles)
- Gross pay, per-mile deductions breakdown, projected net
- **Scale checkbox** — if checked, deducts $14.50 from revenue automatically
- **Rescale counter** — a +/− counter for number of rescales; each rescale costs $5.00 (e.g. 2 rescales = $10.00 deducted)
- `scaleCost` field already exists on Loads — use it for scale; add `rescaleCount` for the counter
- Final projected net updates live as checkboxes/counter change
- Confirm button writes the delivery date + scale/rescale costs and marks load complete
- Odometer fields from item #4 also collected here (Loaded Start Odometer, Ending Odometer)

---

## 6. ~~Dashboard — Projected Settlement Period Revenue Widget~~ ✓ COMPLETE

**Depends on:** Settlement Resolver (item #1) being in place first

**Goal:** Show a forward-looking revenue estimate for the current settlement period.

### Widget contents
- Header: "Upcoming Settlement" with the period date range (e.g. "Mar 24 – Mar 30")
- List of loads delivered in the current settlement period — PRO number + projectedNet per load
- **Estimated Net Settlement** — sum of projectedNet values for the period, minus standard deductions from UserSettings
- If no loads yet in the period, show a friendly empty state

### Notes
- Settlement period cadence (weekly, biweekly) should be a UserSettings field
- Updates automatically as loads are completed during the week
- "Estimated" label throughout — actual may differ once reconciled

---

## 7. Known Bugs to Fix

- **Duplicate "Loaded Miles" field** in loads.jsx modal (appears twice)
- **MPG server-side calc broken** — `api/server.js` ~line 384: `id: { [Op.lt]: 0 }` never matches; previous fuel stop lookup always returns null
- **Debug console.log statements** left in loads.jsx (component render, useMemo, table row calculations)

---

## 8. Future / Backlog

- Tax summary page (quarterly estimated taxes, Schedule C prep)
- Export to CSV / PDF
- Bug reporting feature polish
- Error logging improvements
- Push notifications for settlement reminders
