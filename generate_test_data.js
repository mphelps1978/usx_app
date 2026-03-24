const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./api/database.sqlite');

async function generateData() {
  console.log('Starting data generation...');

  // Clear existing data
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM FuelStops; DELETE FROM Loads; DELETE FROM Users WHERE email != "phelpscdl@gmail.com"', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Create user if not exists
  const userExists = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM Users WHERE email = ?', ['phelpscdl@gmail.com'], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  let userId;
  if (!userExists) {
    const hashedPassword = await bcrypt.hash('Pwa2h2r!', 10);
    userId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO Users (username, email, password) VALUES (?, ?, ?)',
        ['testuser', 'phelpscdl@gmail.com', hashedPassword], function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });
  } else {
    userId = userExists.id;
  }

  console.log('User ID:', userId);

  // Generate 100 loads
  const loads = [];
  for (let i = 1; i <= 100; i++) {
    const date = new Date(2026, 0, i); // Start from Jan 1, 2026
    if (date > new Date()) break;

    loads.push([
      `PRO${String(i).padStart(6, '0')}`,
      userId,
      date.toISOString().split('T')[0],
      'OriginCity',
      'OR',
      'DestCity',
      'CA',
      Math.floor(Math.random() * 500) + 100, // deadhead miles
      Math.floor(Math.random() * 1000) + 500, // loaded miles
      Math.floor(Math.random() * 10000) + 20000, // weight
      'percentage',
      Math.floor(Math.random() * 2000) + 1000, // linehaul
      Math.floor(Math.random() * 500) + 100, // fsc
      null, // fscPerLoadedMile
      Math.floor(Math.random() * 1000) + 500, // calculatedGross
      Math.floor(Math.random() * 800) + 400, // projectedNet
      Math.floor(Math.random() * 100) + 20, // scaleCost
      Math.random() * 0.05, // fuelRoadUseTax
      Math.random() * 0.05, // maintenanceReserve
      Math.random() * 0.02, // bondDeposit
      Math.random() * 0.03, // mrpFee
      Math.random() * 200, // totalDeductions
      null, // dateDelivered
      null, // startingOdometer
      null, // endingOdometer
      null, // actualMiles
      0 // fuelCost
    ]);
  }

  // Insert loads
  for (const load of loads) {
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO Loads (proNumber, userId, dateDispatched, originCity, originState, destinationCity, destinationState, deadheadMiles, loadedMiles, weight, driverPayType, linehaul, fsc, fscPerLoadedMile, calculatedGross, projectedNet, scaleCost, fuelRoadUseTax, maintenanceReserve, bondDeposit, mrpFee, totalDeductions, dateDelivered, startingOdometer, endingOdometer, actualMiles, fuelCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        load, (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  // Generate 100 fuel stops
  const fuelStops = [];
  let currentOdometer = 100000;

  for (let i = 1; i <= 100; i++) {
    const date = new Date(2026, 0, i + 10); // Start from Jan 11, 2026
    if (date > new Date()) break;

    const gallons = Math.floor(Math.random() * 100) + 50;
    const price = 3.5 + Math.random() * 1.5;
    const totalCost = gallons * price;

    currentOdometer += Math.floor(Math.random() * 500) + 200;

    fuelStops.push([
      loads[i % loads.length][0], // proNumber
      userId,
      date.toISOString().split('T')[0],
      'Love\'s',
      'Various City, TX',
      gallons,
      price,
      totalCost,
      Math.floor(Math.random() * 20) + 5, // def gallons
      4.0 + Math.random(), // def price
      null, // totalDefCost
      totalCost + (Math.floor(Math.random() * 20) + 5) * (4.0 + Math.random()), // totalFuelStop
      1, // fuelCardUsed
      1, // discountEligible
      currentOdometer,
      currentOdometer - Math.floor(Math.random() * 500) - 200,
      null, // calculatedMpg
      null, // settledDieselPricePerGallon
      null // settledTotalDieselCost
    ]);
  }

  // Insert fuel stops
  for (const stop of fuelStops) {
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO FuelStops (proNumber, userId, dateOfStop, vendor, location, gallonsDieselPurchased, dieselPricePerGallon, totalDieselCost, gallonsDefPurchased, defPricePerGallon, totalDefCost, totalFuelStop, fuelCardUsed, discountEligible, odometerReading, previousOdometer, calculatedMpg, settledDieselPricePerGallon, settledTotalDieselCost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        stop, (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
  }

  console.log('Generated 100 loads and 100 fuel stops');
  db.close();
}

generateData().catch(console.error);