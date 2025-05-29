// testdb.js
try {
  const db = require('./db');
  console.log('Successfully required ./db.js');
  console.log('User:', db.User);
  console.log('Loads:', db.Loads);
  console.log('FuelStop:', db.FuelStop); // Check if FuelStop is part of the export
} catch (error) {
  console.error('Error requiring ./db.js:', error);
}