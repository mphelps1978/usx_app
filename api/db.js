// db.js
const { Sequelize } = require('sequelize');
// const path = require('path'); // path module is not strictly needed here if .env is loaded by server.js

// It's assumed that 'dotenv' is configured in the main application entry point (e.g., server.js)
// by calling require('dotenv').config() at the very top.
// This ensures process.env variables are populated before this db.js module is loaded.

// Retrieve the DATABASE_URL from environment variables.
const dbUrl = process.env.DATABASE_URL;

// Log the DATABASE_URL being used. This is crucial for debugging connection issues.
console.log(`[DB] DATABASE_URL from process.env: ${dbUrl}`);

// If DATABASE_URL is not found, log a fatal error and exit.
// This prevents the application from trying to run without a database configuration.
if (!dbUrl) {
  console.error('[DB] FATAL: DATABASE_URL is not defined. Ensure .env is loaded by the application entry point (e.g., server.js).');
  process.exit(1); // Exit the process with an error code.
}

// Initialize a new Sequelize instance.
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true, // Enforce SSL connection, necessary for services like Supabase.
      rejectUnauthorized: false, // Often needed for cloud DB services with pooled connections.
      // For production, consider using the CA certificate from your DB provider
      // and setting rejectUnauthorized to true for better security.
    },
  },
  // Configure Sequelize logging.
  // Log SQL queries in development for debugging, but disable in production for performance and cleaner logs.
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Declare model variables. They will be assigned after successful DB authentication.
let User, Loads, FuelStops, UserSettings;

// Renamed for clarity: this function initializes and returns the DB components.
async function initializeDatabaseAndModels() {
  try {
    // Step 1: Authenticate the database connection.
    await sequelize.authenticate();
    console.log('[DB] Database connection successful!');

    // Step 2: Load (require and initialize) Sequelize models.
    // Models are defined in separate files and passed the sequelize instance.
    User = require('./models/User')(sequelize);
    Loads = require('./models/Loads')(sequelize);
    FuelStops = require('./models/FuelStops')(sequelize);
    UserSettings = require('./models/UserSettings')(sequelize);
    console.log('[DB] All models loaded successfully.');

    // Step 3: Define associations between models.
    // User and Loads: One-to-Many
    User.hasMany(Loads, { foreignKey: 'userId', as: 'loads' }); // Added alias
    Loads.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Added alias

    // Loads and FuelStops: One-to-Many (A Load can have many FuelStops)
    Loads.hasMany(FuelStops, { foreignKey: 'proNumber', sourceKey: 'proNumber', as: 'fuelStops' });
    FuelStops.belongsTo(Loads, { foreignKey: 'proNumber', targetKey: 'proNumber', as: 'load' });

    // User and FuelStops: One-to-Many (A User can have many FuelStops, directly or through Loads)
    User.hasMany(FuelStops, { foreignKey: 'userId', as: 'userFuelStops' }); // Added alias
    FuelStops.belongsTo(User, { foreignKey: 'userId', as: 'user' });

    // User and UserSettings: One-to-One
    User.hasOne(UserSettings, { foreignKey: 'userId', as: 'settings' });
    UserSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    console.log('[DB] All model associations defined.');

    // Step 4: Sync all defined models to the database.
    // `alter: true` attempts to alter existing tables to match the model.
    // Be cautious with `alter: true` in production as it can lead to data loss if not handled carefully.
    // For production, consider using migrations instead of `sync`.
    // `{ force: true }` would drop and recreate tables - use only in development.
    await sequelize.sync({ alter: true });
    console.log('[DB] All tables synced successfully!');

    // Return the initialized components so they can be used after awaiting this function.
    return {
      sequelize,
      User,
      Loads,
      FuelStops,
      UserSettings,
    };

  } catch (error) {
    // If any step in the initialization fails, log the error and exit the application.
    console.error('[DB] !!! DATABASE INITIALIZATION FAILED !!!');
    console.error('[DB] Error details:', error);
    process.exit(1); // Exit the process with an error code.
  }
}

// Export the promise returned by calling the initialization function.
// Other modules will await this promise to get the DB components.
module.exports = initializeDatabaseAndModels();