const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// SQL statements to add missing columns
const migrations = [
  // Add columns to users table
  `ALTER TABLE users ADD COLUMN driverPayType TEXT DEFAULT 'percentage'`,
  `ALTER TABLE users ADD COLUMN percentageRate REAL DEFAULT 0.68`,
  `ALTER TABLE users ADD COLUMN fuelRoadUseTax REAL DEFAULT 0.01`,
  `ALTER TABLE users ADD COLUMN maintenanceReserve REAL DEFAULT 0.05`,
  `ALTER TABLE users ADD COLUMN bondDeposit REAL DEFAULT 0.04`,
  `ALTER TABLE users ADD COLUMN mrpFee REAL DEFAULT 0.09`,

  // Add columns to loads table
  `ALTER TABLE loads ADD COLUMN startingOdometer INTEGER`,
  `ALTER TABLE loads ADD COLUMN endingOdometer INTEGER`,
  `ALTER TABLE loads ADD COLUMN actualMiles INTEGER`,

  // Add columns to fuelStops table
  `ALTER TABLE fuelStops ADD COLUMN previousOdometer INTEGER`,
  `ALTER TABLE fuelStops ADD COLUMN calculatedMpg REAL`,
  `ALTER TABLE fuelStops ADD COLUMN vendor TEXT`,
  `ALTER TABLE fuelStops ADD COLUMN location TEXT`,
  `ALTER TABLE fuelStops ADD COLUMN gallonsDieselPurchased REAL`,
  `ALTER TABLE fuelStops ADD COLUMN dieselPricePerGallon REAL`,
  `ALTER TABLE fuelStops ADD COLUMN totalDieselCost REAL`,
  `ALTER TABLE fuelStops ADD COLUMN gallonsDefPurchased REAL`,
  `ALTER TABLE fuelStops ADD COLUMN defPricePerGallon REAL`,
  `ALTER TABLE fuelStops ADD COLUMN totalDefCost REAL`,
  `ALTER TABLE fuelStops ADD COLUMN totalFuelStop REAL`,
  `ALTER TABLE fuelStops ADD COLUMN settledDieselPricePerGallon REAL`,
  `ALTER TABLE fuelStops ADD COLUMN settledTotalDieselCost REAL`,
  `ALTER TABLE fuelStops ADD COLUMN fuelCardUsed BOOLEAN DEFAULT 1`,
  `ALTER TABLE fuelStops ADD COLUMN discountEligible BOOLEAN DEFAULT 1`,
  `ALTER TABLE fuelStops ADD COLUMN odometerReading REAL`
];

async function runMigrations() {
  console.log('Starting database migrations...');

  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    console.log(`Running migration ${i + 1}: ${sql}`);

    try {
      await new Promise((resolve, reject) => {
        db.run(sql, function (err) {
          if (err) {
            console.log(`Migration ${i + 1} failed (likely column already exists):`, err.message);
            // Don't reject for column already exists errors
            if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
              resolve();
            } else {
              reject(err);
            }
          } else {
            console.log(`Migration ${i + 1} completed successfully`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Error running migration ${i + 1}:`, error.message);
    }
  }

  console.log('Database migrations completed!');
  db.close();
}

runMigrations();