// testdb.js
console.log('[TESTDB] Starting testdb.js script...');
console.log('[TESTDB] Attempting to require ./db.js. This will trigger database connection attempt in db.js.');

try {
  // Requiring db.js will execute its content, including the authenticate() call.
  // If db.js calls process.exit() due to an error, this script will also terminate.
  const db = require('./db');
  console.log('[TESTDB] Successfully required ./db.js.');

  // If db.js completed its connection and model initialization without exiting:
  if (db.sequelize) {
    console.log('[TESTDB] Sequelize instance is available from db module.');
  } else {
    console.error('[TESTDB] Sequelize instance is NOT available from db module (this should not happen if db.js loaded).');
  }

  // Check if models are available (they might be undefined if connection failed before model init in db.js)
  // console.log('[TESTDB] User model (via getter):', db.User);
  // console.log('[TESTDB] Loads model (via getter):', db.Loads);
  // console.log('[TESTDB] FuelStops model (via getter):', db.FuelStops); // Corrected from FuelStop
  // console.log('[TESTDB] UserSettings model (via getter):', db.UserSettings);

} catch (error) {
  // This catch block might not be reached if db.js calls process.exit()
  console.error('[TESTDB] Critical error during require("./db.js") or its subsequent execution:', error);
}
console.log('[TESTDB] testdb.js script finished (or was terminated by db.js).');