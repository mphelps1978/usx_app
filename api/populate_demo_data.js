/**
 * populate_demo_data.js
 *
 * Clears the existing SQLite database and populates it with realistic 2026
 * demo data for the user phelpscdl@gmail.com.
 *
 * Usage: node populate_demo_data.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ── Delete existing DB so schema is recreated cleanly ────────────────────────
const dbPath = path.join(__dirname, 'database.sqlite');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('[POPULATE] Cleared existing database.sqlite');
}

const dbPromise = require('./db');

// ── Constants ────────────────────────────────────────────────────────────────
const PERCENTAGE_RATE    = 0.68;
const FUEL_ROAD_USE_TAX  = 0.01;  // per mile
const MAINTENANCE_RESERVE = 0.05; // per mile
const BOND_DEPOSIT        = 0.04; // per mile
const MRP_FEE             = 0.09; // per mile
const STARTING_ODOMETER = 234500;
const NUM_LOADS = 100;

// ── Route templates ───────────────────────────────────────────────────────────
// [originCity, originState, destCity, destState, loadedMiles, deadheadMiles, minWeight, maxWeight]
const ROUTES = [
  ['Atlanta',       'GA', 'Charlotte',      'NC',  245, 30, 40000, 44000],
  ['Charlotte',     'NC', 'Washington',     'DC',  395, 35, 38000, 44000],
  ['Washington',    'DC', 'Boston',         'MA',  440, 45, 36000, 44000],
  ['Boston',        'MA', 'Pittsburgh',     'PA',  480, 50, 38000, 44000],
  ['Pittsburgh',    'PA', 'Indianapolis',   'IN',  365, 35, 40000, 45000],
  ['Indianapolis',  'IN', 'Nashville',      'TN',  290, 30, 38000, 44000],
  ['Nashville',     'TN', 'Memphis',        'TN',  210, 25, 36000, 43000],
  ['Memphis',       'TN', 'Dallas',         'TX',  450, 45, 38000, 44000],
  ['Dallas',        'TX', 'Houston',        'TX',  240, 30, 40000, 45000],
  ['Houston',       'TX', 'Atlanta',        'GA',  790, 55, 36000, 44000],
  ['Atlanta',       'GA', 'Columbus',       'OH',  680, 45, 38000, 44000],
  ['Columbus',      'OH', 'Chicago',        'IL',  360, 40, 40000, 45000],
  ['Chicago',       'IL', 'Kansas City',    'MO',  500, 45, 36000, 44000],
  ['Kansas City',   'MO', 'Dallas',         'TX',  490, 50, 38000, 45000],
  ['Dallas',        'TX', 'New Orleans',    'LA',  510, 45, 40000, 45000],
  ['New Orleans',   'LA', 'Jacksonville',   'FL',  540, 50, 36000, 43000],
  ['Jacksonville',  'FL', 'Charlotte',      'NC',  550, 45, 38000, 44000],
  ['Charlotte',     'NC', 'Philadelphia',   'PA',  485, 40, 40000, 45000],
  ['Philadelphia',  'PA', 'Chicago',        'IL',  760, 55, 36000, 44000],
  ['Chicago',       'IL', 'Nashville',      'TN',  480, 45, 38000, 44000],
  ['Nashville',     'TN', 'Atlanta',        'GA',  250, 30, 40000, 45000],
  ['Atlanta',       'GA', 'Birmingham',     'AL',  150, 25, 36000, 43000],
  ['Birmingham',    'AL', 'Memphis',        'TN',  240, 35, 38000, 44000],
  ['Memphis',       'TN', 'Louisville',     'KY',  385, 40, 40000, 45000],
  ['Louisville',    'KY', 'Detroit',        'MI',  310, 35, 36000, 44000],
  ['Detroit',       'MI', 'Cleveland',      'OH',  170, 25, 38000, 44000],
  ['Cleveland',     'OH', 'New York',       'NY',  455, 45, 40000, 45000],
  ['New York',      'NY', 'Atlanta',        'GA',  870, 60, 36000, 44000],
  ['Atlanta',       'GA', 'Houston',        'TX',  790, 55, 38000, 45000],
  ['Houston',       'TX', 'Memphis',        'TN',  565, 45, 40000, 45000],
  ['Memphis',       'TN', 'Indianapolis',   'IN',  410, 40, 36000, 44000],
  ['Indianapolis',  'IN', 'Pittsburgh',     'PA',  365, 35, 38000, 44000],
];

const VENDORS   = ["Love's", 'Pilot Flying J', 'TA Petro', 'Flying J', 'Pilot'];
const TRAILERS  = ['T48231', 'T39175', 'T52847', 'T41392', 'T67284',
                   'T35621', 'T48903', 'T72156', 'T29481', 'T55374'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deterministic integer in [min, max) using linear-congruential generator. */
function det(seed, min, max) {
  if (max <= min) return min;
  const v = ((seed * 1664525 + 1013904223) >>> 0);
  return min + (v % (max - min));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmt(date) {
  return date.toISOString().split('T')[0];
}

function round2(n) { return Math.round(n * 100) / 100; }

// ── Main ──────────────────────────────────────────────────────────────────────
async function populate() {
  console.log('[POPULATE] Starting...');
  const { User, Loads, FuelStops, UserSettings } = await dbPromise;

  // 1. Create user
  console.log('[POPULATE] Creating user phelpscdl@gmail.com ...');
  const hashedPassword = await bcrypt.hash('Pwa2h2r!', 10);
  const user = await User.create({
    username: 'phelpscdl',
    email:    'phelpscdl@gmail.com',
    password: hashedPassword,
  });

  // 2. User settings
  console.log('[POPULATE] Creating user settings...');
  await UserSettings.create({
    userId:            user.id,
    driverPayType:     'percentage',
    percentageRate:    PERCENTAGE_RATE,
    fuelRoadUseTax:    FUEL_ROAD_USE_TAX,
    maintenanceReserve: MAINTENANCE_RESERVE,
    bondDeposit:       BOND_DEPOSIT,
    mrpFee:            MRP_FEE,
  });

  // 3. Generate loads + fuel stops
  let currentDate     = new Date('2026-01-05T00:00:00Z');
  let odometer        = STARTING_ODOMETER;
  let lastFuelOdometer = null; // tracks across all loads for MPG

  console.log('[POPULATE] Generating 100 loads...');

  for (let i = 0; i < NUM_LOADS; i++) {
    const route = ROUTES[i % ROUTES.length];
    const [oc, os, dc, ds, baseLM, baseDH, minW, maxW] = route;

    // Vary miles ±8 % deterministically
    const loadedMiles   = Math.round(baseLM * (0.94 + det(i * 7,  0, 13) / 100));
    const deadheadMiles = Math.round(baseDH * (0.90 + det(i * 13, 0, 21) / 100));
    const totalMiles    = loadedMiles + deadheadMiles;

    // Drive days: 1 day ≤300 mi, 2 days ≤650 mi, 3 days otherwise
    const driveDays = totalMiles <= 350 ? 1 : totalMiles <= 650 ? 2 : 3;

    const dateDispatched = new Date(currentDate);
    const isLastLoad     = (i === NUM_LOADS - 1);
    const dateDelivered  = isLastLoad ? null : addDays(dateDispatched, driveDays);

    // Pay — linehaul rate varies $2.80–$3.40/loaded mile; FSC $0.42–$0.70/loaded mile
    const linehaulRate = 2.80 + det(i * 17, 0, 61) / 100;
    const fscPerMile   = 0.42 + det(i * 23, 0, 29) / 100;
    const linehaul     = round2(loadedMiles * linehaulRate);
    const fsc          = round2(loadedMiles * fscPerMile);
    const calculatedGross = round2(linehaul * PERCENTAGE_RATE + fsc);

    // Per-mile deductions
    const fuelRoadUseDeduction   = round2(totalMiles * FUEL_ROAD_USE_TAX);
    const maintenanceDeduction   = round2(totalMiles * MAINTENANCE_RESERVE);
    const bondDeduction          = round2(totalMiles * BOND_DEPOSIT);
    const mrpDeduction           = round2(totalMiles * MRP_FEE);
    const totalDeductions        = round2(fuelRoadUseDeduction + maintenanceDeduction + bondDeduction + mrpDeduction);

    // Scale cost on every 5th load
    const scaleCost = (i % 5 === 2) ? round2(det(i, 30, 76)) : 0;

    // Weight and trailer
    const weight        = minW + det(i * 11, 0, maxW - minW);
    const trailerNumber = TRAILERS[i % TRAILERS.length];

    // Odometer: start = dispatch (before deadhead); pickup = after deadhead; end = delivery
    const startingOdometer = odometer;
    const loadedStartOdometer = isLastLoad ? null : odometer + deadheadMiles;
    const endingOdometer = isLastLoad ? null : odometer + deadheadMiles + loadedMiles;
    const actualDeadheadMiles = isLastLoad ? null : deadheadMiles;
    const actualLoadedMiles = isLastLoad ? null : loadedMiles;
    const actualMiles = isLastLoad ? null : totalMiles;

    const projectedNet = round2(calculatedGross - totalDeductions - scaleCost);

    const proNumber = `26${String(i + 1).padStart(5, '0')}`;

    // ── Create load ──────────────────────────────────────────────────────────
    await Loads.create({
      proNumber,
      userId:           user.id,
      dateDispatched:   fmt(dateDispatched),
      dateDelivered:    isLastLoad ? null : fmt(dateDelivered),
      trailerNumber,
      originCity:       oc,
      originState:      os,
      destinationCity:  dc,
      destinationState: ds,
      deadheadMiles,
      loadedMiles,
      totalMiles,
      weight,
      startingOdometer,
      loadedStartOdometer,
      endingOdometer,
      actualDeadheadMiles,
      actualLoadedMiles,
      actualMiles,
      driverPayType:    'percentage',
      linehaul,
      fsc,
      fscPerLoadedMile: null,
      calculatedGross,
      fuelCost:         0,
      scaleCost,
      fuelRoadUseTax:   fuelRoadUseDeduction,
      maintenanceReserve: maintenanceDeduction,
      bondDeposit:      bondDeduction,
      mrpFee:           mrpDeduction,
      totalDeductions,
      projectedNet,
    });

    // ── Generate fuel stops ──────────────────────────────────────────────────
    // 1 stop for ≤400 miles, 2 stops otherwise
    const numStops = totalMiles <= 400 ? 1 : 2;

    // Spread stop odometers evenly through the trip
    const stopFractions = numStops === 1 ? [0.65] : [0.42, 0.88];

    for (let j = 0; j < numStops; j++) {
      const seed = i * 100 + j * 7;

      const stopOdometer  = Math.round(odometer + totalMiles * stopFractions[j]);

      // Gallons: derived from distance since last fillup at ~6.5 MPG, plus a top-off buffer
      const distSinceLast = lastFuelOdometer !== null
        ? stopOdometer - lastFuelOdometer
        : Math.round(totalMiles * stopFractions[j]);
      const mpgEst   = 6.0 + det(seed * 3, 0, 16) / 10;        // 6.0–7.5 MPG
      const needed   = distSinceLast / mpgEst;
      const topOff   = 15 + det(seed, 0, 26);                   // 15–40 gal buffer
      const gallons  = Math.round(Math.min(150, Math.max(45, needed + topOff)));

      // Diesel pump price — trends slightly higher over the year; ±$0.25 variation
      const basePrice       = 3.55 + (i / 100) * 0.45;
      const priceVariation  = (det(seed * 7, 0, 51) - 25) / 100;
      const pumpPrice       = round2(Math.max(3.10, basePrice + priceVariation));

      const fuelCardUsed     = det(seed * 11, 0, 10) >= 2; // 80 % true
      const discountEligible = det(seed * 13, 0, 10) >= 2; // 80 % true

      const dieselDiscount  = discountEligible ? 0.05 : 0;
      const totalDieselCost = round2((pumpPrice - dieselDiscount) * gallons);

      // DEF on ~30 % of stops — 2–4 gallons at $2.80–$3.80/gal
      const hasDef        = det(seed * 17, 0, 10) >= 7;
      const gallonsDef    = hasDef ? (2 + det(seed * 19, 0, 3)) : null;
      const defPrice      = hasDef ? round2(2.80 + det(seed * 23, 0, 101) / 100) : null;
      const totalDefCost  = hasDef ? round2(gallonsDef * defPrice) : 0;

      let totalFuelStop = round2(totalDieselCost + totalDefCost + (fuelCardUsed ? 1.00 : 0));

      // Settled price for all completed loads (~83–89 % of pump price)
      let settledDieselPricePerGallon = null;
      let settledTotalDieselCost      = null;
      if (!isLastLoad) {
        const settleFactor              = (83 + det(seed * 29, 0, 7)) / 100;
        settledDieselPricePerGallon     = round2(pumpPrice * settleFactor);
        settledTotalDieselCost          = round2(settledDieselPricePerGallon * gallons);
      }

      const vendor   = VENDORS[det(seed * 31, 0, VENDORS.length)];
      const location = j === 0 ? `${oc}, ${os}` : `${dc}, ${ds}`;

      // MPG based on miles since last fuel stop (cross-load tracking)
      let calculatedMpg = null;
      if (lastFuelOdometer !== null) {
        const milesSinceLast = stopOdometer - lastFuelOdometer;
        if (gallons > 0 && milesSinceLast > 0) {
          calculatedMpg = round2(milesSinceLast / gallons);
        }
      }

      // Stop date: fraction of drive days after dispatch
      const stopDayOffset = Math.max(0, Math.round(driveDays * stopFractions[j]));
      const stopDate      = addDays(dateDispatched, stopDayOffset);

      await FuelStops.create({
        proNumber,
        userId:                    user.id,
        dateOfStop:                fmt(stopDate),
        vendor,
        location,
        gallonsDieselPurchased:    gallons,
        dieselPricePerGallon:      pumpPrice,
        totalDieselCost,
        gallonsDefPurchased:       gallonsDef,
        defPricePerGallon:         defPrice,
        totalDefCost,
        totalFuelStop,
        fuelCardUsed,
        discountEligible,
        odometerReading:           stopOdometer,
        previousOdometer:          lastFuelOdometer,
        calculatedMpg,
        settledDieselPricePerGallon,
        settledTotalDieselCost,
      });

      lastFuelOdometer = stopOdometer;
    }

    // Advance odometer to end of this load (same as endingOdometer when delivered)
    odometer += deadheadMiles + loadedMiles;

    // Next dispatch: 1–2 days of home time after delivery
    if (!isLastLoad) {
      const homeDays  = 1 + (det(i * 37, 0, 3) === 0 ? 1 : 0);
      currentDate     = addDays(dateDelivered, homeDays);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`[POPULATE]  ... ${i + 1} loads created`);
    }
  }

  console.log(`[POPULATE] Done! 100 loads created.`);
  console.log(`[POPULATE] Final odometer: ${odometer.toLocaleString()} miles`);
  console.log(`[POPULATE] Miles driven in 2026: ${(odometer - STARTING_ODOMETER).toLocaleString()}`);
  console.log(`\n[POPULATE] Login credentials:`);
  console.log(`           Email:    phelpscdl@gmail.com`);
  console.log(`           Password: Pwa2h2r!`);
  process.exit(0);
}

populate().catch(err => {
  console.error('[POPULATE] Fatal error:', err);
  process.exit(1);
});
