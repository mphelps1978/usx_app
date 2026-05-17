// db.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Sequelize } = require('sequelize');

// Local dev: api/.env. Production (Dockploy): set DATABASE_URL on the API service (runtime env).
require('dotenv').config({ path: path.join(__dirname, '.env') });

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.Database_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
  ];
  for (const raw of candidates) {
    if (raw && String(raw).trim()) return String(raw).trim();
  }
  return '';
}

const dbUrl = resolveDatabaseUrl();

/** Hostname from a postgres URL, for SSL heuristics and safe logging. */
function postgresConnectionTarget(url) {
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, 'http:');
    const u = new URL(normalized);
    return { host: u.hostname || '', database: (u.pathname || '/').replace(/^\//, '') || 'postgres' };
  } catch {
    return { host: '', database: 'postgres' };
  }
}

/** Windows host IP from /etc/resolv.conf (unreliable on some WSL builds; see resolveWslWindowsHost). */
function readWindowsHostFromWslResolv() {
  try {
    const text = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const m = text.match(/^nameserver\s+(\S+)/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Default IPv4 gateway in WSL2 is usually the Windows host (works when nameserver is 10.255.255.254). */
function readDefaultGatewayWsl() {
  try {
    const out = execSync('ip -4 route show default', { encoding: 'utf8', timeout: 5000 });
    const m = out.match(/\bdefault via\s+(\d{1,3}(?:\.\d{1,3}){3})\b/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * IP to reach Windows from WSL for Postgres. Override with PG_WINDOWS_HOST if needed.
 * See: https://github.com/microsoft/WSL/issues/12101 (nameserver 10.255.255.254 is not the service host).
 */
function resolveWslWindowsHost() {
  const manual = process.env.PG_WINDOWS_HOST && process.env.PG_WINDOWS_HOST.trim();
  if (manual) return manual;
  const gateway = readDefaultGatewayWsl();
  if (gateway) return gateway;
  const ns = readWindowsHostFromWslResolv();
  if (ns && ns !== '10.255.255.254') return ns;
  return null;
}

/**
 * When Node runs in WSL but Postgres listens on Windows, 127.0.0.1 is the Linux VM, not Windows.
 * Set PG_USE_WINDOWS_HOST=true and keep localhost/127.0.0.1 in DATABASE_URL; host is rewritten.
 */
function rewriteDatabaseUrlForWslWindowsPostgres(url) {
  const flag = process.env.PG_USE_WINDOWS_HOST;
  if (flag !== 'true' && flag !== '1') return url;
  const win = resolveWslWindowsHost();
  if (!win) {
    console.warn(
      '[DB] PG_USE_WINDOWS_HOST is set but could not resolve Windows host IP '
      + '(tried default route, then /etc/resolv.conf). Set PG_WINDOWS_HOST to the output of: ip -4 route show default',
    );
    return url;
  }
  try {
    const normalized = url.replace(/^postgres(ql)?:/i, 'http:');
    const u = new URL(normalized);
    const h = u.hostname.toLowerCase();
    if (h !== '127.0.0.1' && h !== 'localhost') return url;
    u.hostname = win;
    const rest = u.toString().replace(/^https?:\/\//i, '');
    return `postgresql://${rest}`;
  } catch (e) {
    console.warn('[DB] Could not rewrite DATABASE_URL for WSL:', e.message);
    return url;
  }
}

function isPrivateOrLocalHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (h.endsWith('.local')) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  const m = /^172\.(\d+)\.\d+\.\d+$/.exec(h);
  if (m) {
    const second = parseInt(m[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/** Local / LAN Postgres has no TLS; cloud (e.g. Supabase) needs SSL. */
function useSslForPostgres(url) {
  const explicit = process.env.DATABASE_SSL;
  if (explicit === 'true' || explicit === '1') return true;
  if (explicit === 'false' || explicit === '0') return false;
  const { host } = postgresConnectionTarget(url);
  if (isPrivateOrLocalHost(host)) return false;
  return true;
}

// If DATABASE_URL is not found, log a fatal error and exit.
// This prevents the application from trying to run without a database configuration.
if (!dbUrl) {
  const envKeys = Object.keys(process.env).filter((k) => /database|postgres|db_url/i.test(k));
  console.error('[DB] FATAL: DATABASE_URL is not defined.');
  console.error('[DB] Set runtime env DATABASE_URL on the API service in Dockploy (exact name, all caps).');
  console.error('[DB] No .env file is baked into the Docker image; Dockploy must inject variables at run time.');
  if (envKeys.length) {
    console.error('[DB] Related env keys present:', envKeys.join(', '));
  } else {
    console.error('[DB] No database-related env keys found in process.env.');
  }
  process.exit(1);
}

const resolvedDbUrl = rewriteDatabaseUrlForWslWindowsPostgres(dbUrl);
const { host: pgHost, database: pgDatabase } = postgresConnectionTarget(resolvedDbUrl);
const pgConnectTimeoutMs = Math.max(
  1000,
  parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '10000', 10) || 10000,
);
console.log(`[DB] PostgreSQL target: host=${pgHost || '(unknown)'} database=${pgDatabase} ssl=${useSslForPostgres(resolvedDbUrl)} connect_timeout_ms=${pgConnectTimeoutMs}`);

// Determine dialect based on the database URL
const isSQLite = resolvedDbUrl.startsWith('sqlite:');
const dialect = isSQLite ? 'sqlite' : 'postgres';

const pgDialectOptions = (() => {
  const o = {
    // node-postgres: fail fast instead of hanging when firewall drops packets (WSL → Windows).
    connectionTimeoutMillis: pgConnectTimeoutMs,
  };
  if (useSslForPostgres(resolvedDbUrl)) {
    o.ssl = {
      require: true,
      rejectUnauthorized: false,
    };
  }
  return o;
})();

// Initialize a new Sequelize instance.
const sequelize = new Sequelize(resolvedDbUrl, {
  dialect: dialect,
  ...(isSQLite ? {
    // SQLite specific options
    storage: resolvedDbUrl.replace('sqlite:', ''), // Extract file path from URL
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  } : {
    dialectOptions: pgDialectOptions,
    pool: {
      acquire: pgConnectTimeoutMs,
      max: 5,
      idle: 10000,
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }),
});

/**
 * Re-align SERIAL/identity sequences with MAX(pk) after manual imports, deletes, or restores.
 * Prevents: duplicate key value violates unique constraint "Loads_pkey" on INSERT ... DEFAULT id.
 * UserSettings has no serial id (PK is userId); omit it.
 */
async function syncPostgresIdSequences(sequelize) {
  const tables = [
    { table: 'Users', column: 'id' },
    { table: 'Loads', column: 'id' },
    { table: 'FuelStops', column: 'id' },
    { table: 'BugReports', column: 'id' },
    { table: 'Vendors', column: 'id' },
    { table: 'OfficeExpenses', column: 'id' },
  ];
  for (const { table, column } of tables) {
    try {
      const [rows] = await sequelize.query(
        `SELECT COALESCE(MAX("${column}"), 0) AS max_id FROM "${table}"`
      );
      const maxId = Number(rows[0]?.max_id ?? 0);
      const [seqRows] = await sequelize.query(
        `SELECT pg_get_serial_sequence('"${table}"', '${column}') AS seq`
      );
      const seq = seqRows[0]?.seq;
      if (!seq) {
        console.warn(`[DB] No serial sequence for "${table}"."${column}"; skipped`);
        continue;
      }
      if (maxId < 1) {
        await sequelize.query(`SELECT setval($1::regclass, 1, false)`, { bind: [seq] });
        console.log(`[DB] Synced id sequence for "${table}" (empty table; next id will be 1)`);
      } else {
        await sequelize.query(`SELECT setval($1::regclass, $2, true)`, { bind: [seq, maxId] });
        console.log(`[DB] Synced id sequence for "${table}" to max id ${maxId}`);
      }
    } catch (e) {
      console.warn(`[DB] Skipped id sequence sync for "${table}":`, e.message);
    }
  }
}

// Declare model variables. They will be assigned after successful DB authentication.
let User, Loads, FuelStops, UserSettings, BugReport, Vendor, OfficeExpense;

// Renamed for clarity: this function initializes and returns the DB components.
async function initializeDatabaseAndModels() {
  try {
    // Step 1: Authenticate the database connection.
    console.log('[DB] Connecting...');
    await sequelize.authenticate();
    console.log('[DB] Database connection successful!');

    // Step 2: Load (require and initialize) Sequelize models.
    // Models are defined in separate files and passed the sequelize instance.
    User = require('./models/User')(sequelize);
    Loads = require('./models/Loads')(sequelize);
    FuelStops = require('./models/FuelStops')(sequelize);
    UserSettings = require('./models/UserSettings')(sequelize);
    BugReport = require('./models/BugReport')(sequelize); // Add the new model
    Vendor = require('./models/Vendor')(sequelize);
    OfficeExpense = require('./models/OfficeExpense')(sequelize);
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

    // User and BugReport: One-to-Many (A User can submit many BugReports)
    User.hasMany(BugReport, { foreignKey: 'userId', as: 'bugReports' });
    BugReport.belongsTo(User, { foreignKey: 'userId', as: 'reporter' });

    User.hasMany(Vendor, { foreignKey: 'userId', as: 'vendors' });
    Vendor.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    User.hasMany(OfficeExpense, { foreignKey: 'userId', as: 'officeExpenses' });
    OfficeExpense.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Vendor.hasMany(OfficeExpense, { foreignKey: 'vendorId', as: 'officeExpenses' });
    OfficeExpense.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
    console.log('[DB] All model associations defined.');

    // Step 4: Sync all defined models to the database.
    // For SQLite, use a more robust approach to handle schema changes
    if (isSQLite) {
      // For SQLite, we'll sync without alter to avoid constraint issues
      await sequelize.sync();
      console.log('[DB] SQLite tables synced successfully!');
    } else {
      // alter:true re-validates FKs against existing rows — fails after a partial pg_restore
      // (e.g. FuelStops without matching Loads). Production: create missing tables only.
      const forceAlter = process.env.DB_SYNC_ALTER === 'true' || process.env.DB_SYNC_ALTER === '1';
      const skipAlter = process.env.DB_SYNC_ALTER === 'false' || process.env.DB_SYNC_ALTER === '0';
      const isProduction = process.env.NODE_ENV === 'production';
      const useAlter = forceAlter || (!skipAlter && !isProduction);
      if (useAlter) {
        await sequelize.sync({ alter: true });
        console.log('[DB] PostgreSQL tables synced (alter mode).');
      } else {
        await sequelize.sync();
        console.log('[DB] PostgreSQL tables synced (no alter).');
      }
      await syncPostgresIdSequences(sequelize);
    }

    // Return the initialized components so they can be used after awaiting this function.
    return {
      sequelize,
      User,
      Loads,
      FuelStops,
      UserSettings,
      BugReport,
      Vendor,
      OfficeExpense,
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