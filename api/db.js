// db.js
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const envPath = path.resolve(__dirname, '.env');
console.log(`Attempting to load .env file from: ${envPath}`);
const dotenvResult = require('dotenv').config({ path: envPath });

if (dotenvResult.error) {
  console.error('Error loading .env file:', dotenvResult.error);
} else {
  console.log('.env file loaded successfully.');
}

console.log(`DATABASE_URL from process.env: ${process.env.DATABASE_URL}`);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log, // Enable Sequelize logging to see what it's doing
});

sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch((err) => {
    console.error('!!! Connection error:', err); // More prominent error
    process.exit(1); // Exit if DB connection fails
  });

let User, Loads, FuelStops, UserSettings; // Define UserSettings here

try {
  User = require('./models/User')(sequelize);
  Loads = require('./models/Loads')(sequelize);     // Ensure path is './models/Loads.js'
  FuelStops = require('./models/FuelStops')(sequelize); // Ensure path is './models/FuelStops.js'
  UserSettings = require('./models/UserSettings')(sequelize); // Load UserSettings model

  console.log('User model loaded:', !!User);
  console.log('Loads model loaded:', !!Loads);
  console.log('FuelStops model loaded:', !!FuelStops);
  console.log('UserSettings model loaded:', !!UserSettings); // Log UserSettings load status

  if (!User || !Loads || !FuelStops || !UserSettings) { // Check UserSettings too
    throw new Error('One or more models failed to load!');
  }

  // --- Define associations DIRECTLY and SIMPLY ---
  // User and Loads
  if (User && Loads) {
    User.hasMany(Loads, { foreignKey: 'userId', as: 'loads' }); // Added alias
    Loads.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Added alias
    console.log('User <-> Loads associations defined.');
  } else {
    console.error('User or Loads model is undefined. Cannot define User <-> Loads association.');
  }

  // Loads and FuelStops
  if (Loads && FuelStops) {
    Loads.hasMany(FuelStops, { foreignKey: 'proNumber', sourceKey: 'proNumber', as: 'fuelStops' });
    FuelStops.belongsTo(Loads, { foreignKey: 'proNumber', targetKey: 'proNumber', as: 'load' });
    console.log('Loads <-> FuelStops associations defined.');
  } else {
    console.error('Loads or FuelStops model is undefined. Cannot define Loads <-> FuelStops association.');
  }

  // User and FuelStops
  if (User && FuelStops) {
    User.hasMany(FuelStops, { foreignKey: 'userId', as: 'userFuelStops' }); // Added alias
    FuelStops.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    console.log('User <-> FuelStops associations defined.');
  } else {
    console.error('User or FuelStops model is undefined. Cannot define User <-> FuelStops association.');
  }

  // User and UserSettings (One-to-One)
  if (User && UserSettings) {
    User.hasOne(UserSettings, { foreignKey: 'userId', as: 'settings' });
    UserSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Already in UserSettings.associate, but good for clarity here too
    console.log('User <-> UserSettings associations defined.');
  } else {
    console.error('User or UserSettings model is undefined. Cannot define User <-> UserSettings association.');
  }

} catch (modelError) {
  console.error('!!! Error loading or associating models:', modelError);
  process.exit(1); // Exit if model loading/association fails
}


// // Call associate methods if they exist on the models (COMMENTED OUT)
// const models = { User, Loads, FuelStops };
// Object.values(models)
//   .filter(model => typeof model.associate === 'function')
//   .forEach(model => model.associate(models));


sequelize.sync({ alter: true })
  .then(() => console.log('Tables synced'))
  .catch((err) => {
    console.error('!!! Sync error:', err);
    process.exit(1); // Exit on sync error
  });

const models = { User, Loads, FuelStops, UserSettings }; // Add UserSettings here
// Object.values(models)
//   .filter(model => typeof model.associate === 'function')
//   .forEach(model => model.associate(models));

module.exports = { sequelize, User, Loads, FuelStops, UserSettings }; // Export UserSettings