// server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.DATABASE_URL && !process.env.Database_URL) {
  console.warn('[SERVER] DATABASE_URL is not set yet (expected in Dockploy runtime environment).');
} else {
  console.log('[SERVER] DATABASE_URL is set.');
}

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Import bcrypt
// Import the promise from db.js which will resolve with models and sequelize
const fs = require('fs'); // For file system logging (optional)
const multer = require('multer');
const dbPromise = require('./db');
const receiptStorage = require('./utils/receiptStorage');
const { Op, fn, col, where } = require('sequelize');
const {
  mergeFixedExpensesForRead,
  normalizeFixedExpensesInput,
} = require('./constants/fixedExpenses');
const { ALLOWED_OFFICE_EXPENSE_CATEGORY_VALUES } = require('./constants/officeExpenseCategories');
const { isValidCancelReason } = require('./constants/loadCancelReasons');

function utcDateOnlyString(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Apply isPaid/paidAt to updatedLoadData. Returns error message or null. */
function applyLoadPaidFields(updatedLoadData, loadToUpdate, reqBody) {
  if (!Object.prototype.hasOwnProperty.call(reqBody, 'isPaid')) return null;
  const isPaid = !!reqBody.isPaid;
  if (isPaid) {
    const effectiveDelivered =
      updatedLoadData.dateDelivered !== undefined
        ? updatedLoadData.dateDelivered
        : loadToUpdate.dateDelivered;
    if (!effectiveDelivered) {
      return 'Cannot mark as paid until the load is delivered.';
    }
    updatedLoadData.isPaid = true;
    if (reqBody.paidAt !== undefined && reqBody.paidAt) {
      updatedLoadData.paidAt = reqBody.paidAt;
    } else {
      updatedLoadData.paidAt = utcDateOnlyString();
    }
  } else {
    updatedLoadData.isPaid = false;
    updatedLoadData.paidAt = null;
  }
  return null;
}

/**
 * MPG for a fill-up: compare to the user's prior stop by odometer (largest reading
 * strictly less than the current reading). Excludes excludeFuelStopId when recalculating an update.
 */
async function computeMpgFromPreviousStop(FuelStops, { userId, currentOdometer, excludeFuelStopId, gallonsDiesel }) {
  let previousOdometer = null;
  let calculatedMpg = null;
  const co = parseFloat(currentOdometer);
  if (currentOdometer === undefined || currentOdometer === null || currentOdometer === '' || Number.isNaN(co)) {
    return { previousOdometer, calculatedMpg };
  }
  const andConds = [
    { odometerReading: { [Op.ne]: null } },
    { odometerReading: { [Op.lt]: co } },
  ];
  if (excludeFuelStopId != null) {
    andConds.push({ id: { [Op.ne]: excludeFuelStopId } });
  }
  const previousFuelStop = await FuelStops.findOne({
    where: {
      userId,
      [Op.and]: andConds,
    },
    order: [['odometerReading', 'DESC']],
  });
  if (previousFuelStop && previousFuelStop.odometerReading != null) {
    previousOdometer = previousFuelStop.odometerReading;
    const milesSinceLastFillup = co - previousOdometer;
    const gdp = parseFloat(gallonsDiesel);
    if (gdp > 0 && milesSinceLastFillup > 0) {
      calculatedMpg = parseFloat((milesSinceLastFillup / gdp).toFixed(2));
    }
  }
  return { previousOdometer, calculatedMpg };
}

function toNullableNumberLoad(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

/** Tax/odometer splits; derived miles only when all three readings are present and ordered. */
function computeLoadOdometerDerived({ startingOdometer, loadedStartOdometer, endingOdometer }) {
  const s = toNullableNumberLoad(startingOdometer);
  const l = toNullableNumberLoad(loadedStartOdometer);
  const e = toNullableNumberLoad(endingOdometer);
  const base = {
    startingOdometer: s,
    loadedStartOdometer: l,
    endingOdometer: e,
    actualDeadheadMiles: null,
    actualLoadedMiles: null,
    actualMiles: null,
    invalidOrder: false,
  };
  if (s === null || l === null || e === null) {
    return base;
  }
  if (!(s < l && l < e)) {
    return { ...base, invalidOrder: true };
  }
  return {
    ...base,
    actualDeadheadMiles: l - s,
    actualLoadedMiles: e - l,
    actualMiles: e - s,
  };
}

function jwtExpiresForRemember(rememberMe) {
  if (rememberMe) {
    return process.env.JWT_REMEMBER_EXPIRES || '30d';
  }
  return process.env.JWT_SESSION_EXPIRES || '8h';
}

/** Resolve optional fuel-stop PRO: null/blank = general fuel; otherwise validate load. */
async function resolveOptionalFuelStopPro(Loads, proNumber, userId) {
  if (proNumber === undefined || proNumber === null || proNumber === '') {
    return null;
  }
  const load = await Loads.findOne({ where: { proNumber, userId } });
  if (!load) {
    const err = new Error('Associated load not found or access denied.');
    err.status = 404;
    throw err;
  }
  if (load.isCancelled) {
    const err = new Error('Cannot attach fuel to a cancelled load.');
    err.status = 400;
    throw err;
  }
  return proNumber;
}

/** Most recent delivered load's ending odometer for starting the next load. */
async function getLastDeliveredEndingOdometer(Loads, userId) {
  const last = await Loads.findOne({
    where: {
      userId,
      isCancelled: false,
      dateDelivered: { [Op.ne]: null },
      endingOdometer: { [Op.ne]: null },
    },
    order: [['dateDelivered', 'DESC'], ['updatedAt', 'DESC']],
  });
  if (!last || last.endingOdometer == null) return null;
  const n = parseFloat(last.endingOdometer);
  return Number.isNaN(n) ? null : n;
}

const app = express();

if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

/** Hostname from DEPLOYMENT_DOMAIN (e.g. usxicbooks.cloud or https://usxicbooks.cloud). */
function getDeploymentDomainHost() {
  const raw = (process.env.DEPLOYMENT_DOMAIN || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    if (raw.includes('://')) {
      return new URL(raw).hostname;
    }
  } catch {
    /* fall through */
  }
  return raw.replace(/\/.*$/, '').split(':')[0];
}

const deploymentDomainHost = getDeploymentDomainHost();
if (deploymentDomainHost) {
  console.log(`[SERVER] CORS deployment domain: ${deploymentDomainHost} (https + optional http via ALLOW_HTTP_ORIGINS)`);
}

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://172.20.10.4:5173',
  'https://usx-app-ten.vercel.app',
  'https://www.usx-app-ten.vercel.app',
  'https://usxapp-production.up.railway.app',
  'https://usxicbooks.cloud',
  'https://www.usxicbooks.cloud',
];

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

const envFrontendOrigin = normalizeOrigin(process.env.FRONTEND_URL || '');
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => normalizeOrigin(o))
  .filter(Boolean);

const deploymentHttpsOrigins = [];
if (deploymentDomainHost) {
  const base = deploymentDomainHost.startsWith('www.')
    ? deploymentDomainHost.slice(4)
    : deploymentDomainHost;
  deploymentHttpsOrigins.push(`https://${base}`, `https://www.${base}`);
}

const allowedOrigins = [...new Set([
  ...defaultAllowedOrigins,
  ...deploymentHttpsOrigins,
  ...(envFrontendOrigin ? [envFrontendOrigin] : []),
  ...extraOrigins,
])];

console.log('[SERVER] CORS allowed origins:', allowedOrigins.join(', '));

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (deploymentDomainHost) {
    try {
      const u = new URL(origin);
      const allowHttp =
        process.env.ALLOW_HTTP_ORIGINS === 'true' || process.env.ALLOW_HTTP_ORIGINS === '1';
      const okProtocol = u.protocol === 'https:' || (allowHttp && u.protocol === 'http:');
      if (okProtocol) {
        const h = u.hostname.toLowerCase();
        const base = deploymentDomainHost;
        const wwwBase = base.startsWith('www.') ? base.slice(4) : base;
        if (
          h === base ||
          h === `www.${wwwBase}` ||
          h === wwwBase ||
          h.endsWith(`.${wwwBase}`)
        ) {
          return true;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (/^https:\/\/.+\.vercel\.app$/i.test(origin)) return true;
  // Electron / local static server on ephemeral port
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  // Phone/tablet on same Wi‑Fi hitting Vite on this machine (e.g. http://192.168.1.10:5173)
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:') return false;
    const parts = u.hostname.split('.').map((x) => parseInt(x, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return false;
    }
    const [a, b] = parts;
    const isPrivate =
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168);
    if (isPrivate) return true;
  } catch {
    /* ignore */
  }
  return false;
}

// Use callback(null, false) for denials — callback(Error) invokes Express error middleware and can break CORS/preflight.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (isAllowedCorsOrigin(origin)) {
      return callback(null, origin);
    }
    console.warn('[SERVER] CORS blocked origin:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Custom-Header'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(express.json());

const healthOk = (req, res) => res.json({ status: 'ok' });
app.get('/api/health', healthOk);
app.get('/health', healthOk);

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[SERVER] Listening on http://${HOST}:${PORT} (database still initializing…)`);
});

const uploadReceiptMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Wrap the server setup and start logic in an async function
async function startServer() {
  try {
    // Await the promise from db.js to get the initialized models and sequelize instance
    const { User, Loads, FuelStops, UserSettings, BugReport, Vendor, OfficeExpense, sequelize } = await dbPromise;

    // Now User, Loads, FuelStops, UserSettings, and sequelize are defined and ready to use.
    console.log('[SERVER] FuelStops model available after DB init:', !!FuelStops); // Should log true

    // Authentication middleware
    const authenticate = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        // console.log('[AUTH] No token provided'); // Debug
        return res.status(401).json({ message: 'No token provided' });
      }
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('[AUTH] Token validated, userId:', decoded.userId); // Debug
        req.userId = decoded.userId;
        next();
      } catch (err) {
        // console.error('[AUTH] Invalid token:', err.message); // Debug
        res.status(401).json({ message: 'Invalid token' });
      }
    };

    // Register
    app.post('/api/register', async (req, res) => {
      try {
        const { username, email, password } = req.body;
        if (!password) return res.status(400).json({ message: 'Password is required' });
        const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!emailNorm) return res.status(400).json({ message: 'Email is required' });
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const user = await User.create({
          username: typeof username === 'string' ? username.trim() : username,
          email: emailNorm,
          password: hashedPassword,
        });
        // Generate a token for the new user to log them in immediately
        const token = jwt.sign(
          { userId: user.id },
          process.env.JWT_SECRET,
          { expiresIn: jwtExpiresForRemember(!!req.body.rememberMe) },
        );
        res.status(201).json({ message: 'User registered', userId: user.id, token: token });
      } catch (err) {
        console.error('[SERVER] Register error:', err);
        // Check for unique constraint violation (e.g., email already exists)
        if (err.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({ message: 'Email already in use.' });
        }
        res.status(400).json({ message: 'Registration failed' });
      }
    });

    // Login (case-insensitive email — Postgres string compare is case-sensitive by default)
    app.post('/api/login', async (req, res) => {
      try {
        const { email, password, rememberMe } = req.body;
        const emailInput = typeof email === 'string' ? email.trim() : '';
        if (!emailInput) {
          return res.status(400).json({ message: 'Email is required' });
        }
        const user = await User.findOne({
          where: sequelize.where(
            sequelize.fn('lower', sequelize.col('email')),
            emailInput.toLowerCase()
          ),
        });
        // Compare hashed password
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
          { userId: user.id },
          process.env.JWT_SECRET,
          { expiresIn: jwtExpiresForRemember(!!rememberMe) },
        );
        res.json({ token, userId: user.id, rememberMe: !!rememberMe });
      } catch (err) {
        console.error('[SERVER] Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
      }
    });

    // Last delivered ending odometer (prefill starting odometer on new load)
    app.get('/api/loads/last-ending-odometer', authenticate, async (req, res) => {
      try {
        const endingOdometer = await getLastDeliveredEndingOdometer(Loads, req.userId);
        res.json({ endingOdometer });
      } catch (err) {
        console.error('[SERVER] Error fetching last ending odometer:', err);
        res.status(500).json({ message: 'Server error' });
      }
    });

    // Get Loads
    app.get('/api/loads', authenticate, async (req, res) => {
      try {
        // console.log('[SERVER] Fetching loads for user:', req.userId);
        const loads = await Loads.findAll({ where: { userId: req.userId } });
        res.json(loads);
      } catch (err) {
        console.error('[SERVER] Error fetching loads:', err);
        res.status(500).json({ message: 'Server error fetching loads' });
      }
    });

    // Create Load
    app.post('/api/loads', authenticate, async (req, res) => {
      try {
        const {
          driverPayType,
          linehaul,
          fsc,
          fscPerLoadedMile,
          calculatedDeductions,
          fuelRoadUseTax,
          maintenanceReserve,
          bondDeposit,
          mrpFee,
          calculatedGross, // Ensure this is received from frontend
          projectedNet,    // Ensure this is received from frontend
          scaleCost,         // Ensure this is received from frontend
          ...restOfBody
        } = req.body;

        const loadData = {
          ...restOfBody,
          userId: req.userId,
          driverPayType,
          calculatedGross,
          projectedNet,
          scaleCost: scaleCost || 0,
          totalDeductions: calculatedDeductions,
          fuelRoadUseTax,
          maintenanceReserve,
          bondDeposit,
          mrpFee,
          // fuelCost: 0, // Initialize fuelCost if it's not coming from frontend but required by model
        };

        loadData.dateDelivered = loadData.dateDelivered &&
          loadData.dateDelivered !== 'Invalid date' &&
          !isNaN(new Date(loadData.dateDelivered).getTime())
          ? new Date(loadData.dateDelivered)
          : null;

        // If the load being created is active (dateDelivered is null)
        if (!loadData.dateDelivered) {
          const existingActiveLoad = await Loads.findOne({
            where: {
              userId: req.userId,
              dateDelivered: null,
              isCancelled: false,
            },
          });
          if (existingActiveLoad) {
            return res.status(409).json({
              message: 'An active load already exists. Please complete it before adding a new active load.'
            });
          }
        }

        const baseRequiredFields = ['proNumber', 'dateDispatched', 'originCity', 'originState',
          'destinationCity', 'destinationState', 'driverPayType'];
        let allRequiredFields = [...baseRequiredFields];

        if (driverPayType === 'percentage') {
          allRequiredFields.push('linehaul', 'fsc');
          loadData.linehaul = linehaul;
          loadData.fsc = fsc;
          loadData.fscPerLoadedMile = null;
        } else if (driverPayType === 'mileage') {
          allRequiredFields.push('fscPerLoadedMile');
          loadData.fscPerLoadedMile = fscPerLoadedMile;
          loadData.linehaul = null;
          loadData.fsc = null;
        } else {
          return res.status(400).json({ message: 'Invalid driverPayType specified.' });
        }

        for (const field of allRequiredFields) {
          const valueToCheck = loadData.hasOwnProperty(field) ? loadData[field] : req.body[field];
          if (valueToCheck === undefined || valueToCheck === null || valueToCheck === '') {
            if (typeof valueToCheck === 'number' && valueToCheck === 0) continue; // Allow 0 for numeric fields
            return res.status(400).json({ message: `Missing or invalid required field: ${field}` });
          }
        }

        const toNullableFloat = (v) => {
          if (v === undefined || v === null || v === '') return null;
          const n = parseFloat(v);
          return Number.isNaN(n) ? null : n;
        };
        loadData.deadheadMiles = toNullableFloat(loadData.deadheadMiles);
        loadData.loadedMiles = toNullableFloat(loadData.loadedMiles);
        loadData.weight = toNullableFloat(loadData.weight);

        let startingForOdo = loadData.startingOdometer;
        if (toNullableFloat(startingForOdo) == null) {
          const lastEnding = await getLastDeliveredEndingOdometer(Loads, req.userId);
          if (lastEnding != null) startingForOdo = lastEnding;
        }
        const odoCreate = computeLoadOdometerDerived({
          startingOdometer: startingForOdo,
          loadedStartOdometer: loadData.loadedStartOdometer,
          endingOdometer: loadData.endingOdometer,
        });
        loadData.startingOdometer = odoCreate.startingOdometer;
        loadData.loadedStartOdometer = odoCreate.loadedStartOdometer;
        loadData.endingOdometer = odoCreate.endingOdometer;
        loadData.actualDeadheadMiles = odoCreate.actualDeadheadMiles;
        loadData.actualLoadedMiles = odoCreate.actualLoadedMiles;
        loadData.actualMiles = odoCreate.actualMiles;

        if (
          odoCreate.startingOdometer != null &&
          odoCreate.loadedStartOdometer != null &&
          odoCreate.endingOdometer != null &&
          odoCreate.invalidOrder
        ) {
          return res.status(400).json({
            message: 'Odometer readings must satisfy starting < pickup (loaded start) < ending.',
          });
        }

        // Never let the client set PK or Sequelize timestamps on create (avoids pkey conflicts / bad merges).
        delete loadData.id;
        delete loadData.createdAt;
        delete loadData.updatedAt;

        // console.log('[SERVER] Creating load with data:', loadData);
        const load = await Loads.create(loadData);
        res.status(201).json(load);
      } catch (err) {
        console.error('[SERVER] Error creating load:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        if (err.name === 'SequelizeUniqueConstraintError') {
          const constraint = err.parent?.constraint || '';
          const paths = (err.errors || []).map((e) => e.path).filter(Boolean);
          if (constraint === 'Loads_pkey' || paths.includes('id')) {
            console.error('[SERVER] Loads primary key conflict — PostgreSQL id sequence may be out of sync. Restart the API (db.js syncs sequences on startup) or run setval on "Loads".');
            return res.status(409).json({
              message: 'Could not assign a new load id (database sequence out of sync). Restart the server to fix automatically, or contact support.',
            });
          }
          return res.status(409).json({ message: 'Load with this Pro Number already exists.' });
        }
        res.status(500).json({ message: 'Server error during load creation' });
      }
    });

    // Update Load
    app.put('/api/loads/:proNumber', authenticate, async (req, res) => {
      try {
        const { proNumber } = req.params;
        const loadToUpdate = await Loads.findOne({
          where: { proNumber, userId: req.userId },
        });
        if (!loadToUpdate) return res.status(404).json({ message: 'Load not found' });
        if (loadToUpdate.isCancelled) {
          return res.status(400).json({ message: 'Cancelled loads cannot be edited.' });
        }

        const {
          driverPayType, // Will be undefined if not sent, handled below
          linehaul,
          fsc,
          fscPerLoadedMile,
          calculatedGross,
          projectedNet,
          scaleCost,
          fuelRoadUseTax,
          maintenanceReserve,
          bondDeposit,
          mrpFee,
          calculatedDeductions,
          isPaid,
          paidAt,
          ...restOfBody
        } = req.body;

        const updatedLoadData = { ...restOfBody };
        delete updatedLoadData.isPaid;
        delete updatedLoadData.paidAt;

        // Only update fields if they are explicitly provided in the request body
        if (driverPayType !== undefined) updatedLoadData.driverPayType = driverPayType;
        if (calculatedGross !== undefined) updatedLoadData.calculatedGross = calculatedGross;
        if (projectedNet !== undefined) updatedLoadData.projectedNet = projectedNet;
        if (scaleCost !== undefined) updatedLoadData.scaleCost = scaleCost;

        // Add individual deduction fields if provided
        if (fuelRoadUseTax !== undefined) updatedLoadData.fuelRoadUseTax = fuelRoadUseTax;
        if (maintenanceReserve !== undefined) updatedLoadData.maintenanceReserve = maintenanceReserve;
        if (bondDeposit !== undefined) updatedLoadData.bondDeposit = bondDeposit;
        if (mrpFee !== undefined) updatedLoadData.mrpFee = mrpFee;
        if (calculatedDeductions !== undefined) updatedLoadData.totalDeductions = calculatedDeductions;

        if (req.body.hasOwnProperty('dateDelivered')) { // Check if dateDelivered was intentionally sent
          updatedLoadData.dateDelivered = req.body.dateDelivered &&
            req.body.dateDelivered !== 'Invalid date' &&
            !isNaN(new Date(req.body.dateDelivered).getTime())
            ? new Date(req.body.dateDelivered)
            : null;
        }


        // If trying to set the load as active (dateDelivered is null)
        if (updatedLoadData.dateDelivered === null) {
          updatedLoadData.isPaid = false;
          updatedLoadData.paidAt = null;
          const otherActiveLoad = await Loads.findOne({
            where: {
              userId: req.userId,
              dateDelivered: null,
              isCancelled: false,
              proNumber: { [Op.ne]: proNumber }, // Exclude the current load
            },
          });
          if (otherActiveLoad) {
            return res.status(409).json({
              message: 'Another load is already active. Cannot set this load as active.'
            });
          }
        }

        // Use the effective driverPayType (either new from request or existing from DB) for logic
        const effectiveDriverPayType = updatedLoadData.driverPayType || loadToUpdate.driverPayType;

        if (effectiveDriverPayType === 'percentage') {
          if (linehaul !== undefined) updatedLoadData.linehaul = linehaul;
          if (fsc !== undefined) updatedLoadData.fsc = fsc;
          // If switching to percentage or staying percentage, ensure fscPerLoadedMile is null
          if (driverPayType === 'percentage' || (driverPayType === undefined && effectiveDriverPayType === 'percentage')) {
            updatedLoadData.fscPerLoadedMile = null;
          }
        } else if (effectiveDriverPayType === 'mileage') {
          if (fscPerLoadedMile !== undefined) updatedLoadData.fscPerLoadedMile = fscPerLoadedMile;
          // If switching to mileage or staying mileage, ensure linehaul and fsc are null
          if (driverPayType === 'mileage' || (driverPayType === undefined && effectiveDriverPayType === 'mileage')) {
            updatedLoadData.linehaul = null;
            updatedLoadData.fsc = null;
          }
        } else if (driverPayType !== undefined) { // Error only if an invalid type was *provided* in the request
          return res.status(400).json({ message: 'Invalid driverPayType specified for update.' });
        }

        const mergedOdo = {
          startingOdometer: Object.prototype.hasOwnProperty.call(updatedLoadData, 'startingOdometer')
            ? updatedLoadData.startingOdometer
            : loadToUpdate.startingOdometer,
          loadedStartOdometer: Object.prototype.hasOwnProperty.call(updatedLoadData, 'loadedStartOdometer')
            ? updatedLoadData.loadedStartOdometer
            : loadToUpdate.loadedStartOdometer,
          endingOdometer: Object.prototype.hasOwnProperty.call(updatedLoadData, 'endingOdometer')
            ? updatedLoadData.endingOdometer
            : loadToUpdate.endingOdometer,
        };
        const odoPut = computeLoadOdometerDerived(mergedOdo);
        if (Object.prototype.hasOwnProperty.call(updatedLoadData, 'startingOdometer')) {
          updatedLoadData.startingOdometer = odoPut.startingOdometer;
        }
        if (Object.prototype.hasOwnProperty.call(updatedLoadData, 'loadedStartOdometer')) {
          updatedLoadData.loadedStartOdometer = odoPut.loadedStartOdometer;
        }
        if (Object.prototype.hasOwnProperty.call(updatedLoadData, 'endingOdometer')) {
          updatedLoadData.endingOdometer = odoPut.endingOdometer;
        }
        updatedLoadData.actualDeadheadMiles = odoPut.actualDeadheadMiles;
        updatedLoadData.actualLoadedMiles = odoPut.actualLoadedMiles;
        updatedLoadData.actualMiles = odoPut.actualMiles;

        const wasUndelivered = !loadToUpdate.dateDelivered;
        const newDeliveredRaw = updatedLoadData.dateDelivered;
        const becomesDelivered =
          wasUndelivered &&
          newDeliveredRaw !== undefined &&
          newDeliveredRaw !== null &&
          String(newDeliveredRaw).trim() !== '' &&
          !isNaN(new Date(newDeliveredRaw).getTime());

        const willBeDelivered =
          updatedLoadData.dateDelivered !== undefined
            ? updatedLoadData.dateDelivered !== null &&
              String(updatedLoadData.dateDelivered).trim() !== '' &&
              !isNaN(new Date(updatedLoadData.dateDelivered).getTime())
            : !!loadToUpdate.dateDelivered;
        const finalEndingOdometer = Object.prototype.hasOwnProperty.call(
          updatedLoadData,
          'endingOdometer',
        )
          ? odoPut.endingOdometer
          : loadToUpdate.endingOdometer;

        if (willBeDelivered && finalEndingOdometer == null) {
          return res.status(400).json({
            message: 'Ending odometer is required when marking a load as delivered.',
          });
        }

        if (becomesDelivered) {
          if (
            odoPut.startingOdometer != null &&
            odoPut.loadedStartOdometer != null &&
            odoPut.endingOdometer != null &&
            odoPut.invalidOrder
          ) {
            return res.status(400).json({
              message: 'Odometer readings must satisfy starting < pickup (loaded start) < ending.',
            });
          }
        }

        const toNullableFloatPut = (v) => {
          if (v === undefined) return undefined;
          if (v === null || v === '') return null;
          const n = parseFloat(v);
          return Number.isNaN(n) ? null : n;
        };
        if (Object.prototype.hasOwnProperty.call(updatedLoadData, 'deadheadMiles')) {
          updatedLoadData.deadheadMiles = toNullableFloatPut(updatedLoadData.deadheadMiles);
        }
        if (Object.prototype.hasOwnProperty.call(updatedLoadData, 'loadedMiles')) {
          updatedLoadData.loadedMiles = toNullableFloatPut(updatedLoadData.loadedMiles);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'weight')) {
          updatedLoadData.weight = toNullableFloatPut(updatedLoadData.weight);
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'isPaid')) {
          const paidErr = applyLoadPaidFields(updatedLoadData, loadToUpdate, req.body);
          if (paidErr) return res.status(400).json({ message: paidErr });
        }

        delete updatedLoadData.id;
        delete updatedLoadData.createdAt;
        delete updatedLoadData.updatedAt;

        // console.log('[SERVER] Updating load with data:', updatedLoadData);
        await loadToUpdate.update(updatedLoadData);
        res.json(loadToUpdate);
      } catch (err) {
        console.error('[SERVER] Error updating load:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        if (err.name === 'SequelizeUniqueConstraintError') {
          const constraint = err.parent?.constraint || '';
          const paths = (err.errors || []).map((e) => e.path).filter(Boolean);
          if (constraint === 'Loads_pkey' || paths.includes('id')) {
            return res.status(409).json({
              message: 'Could not update load (database id conflict). Restart the server to resync sequences.',
            });
          }
          return res.status(409).json({ message: 'Another load already uses this Pro Number.' });
        }
        res.status(500).json({ message: 'Server error during load update' });
      }
    });

    // Toggle load paid status (delivered loads only)
    app.patch('/api/loads/:proNumber/paid', authenticate, async (req, res) => {
      try {
        const { proNumber } = req.params;
        const loadToUpdate = await Loads.findOne({
          where: { proNumber, userId: req.userId },
        });
        if (!loadToUpdate) return res.status(404).json({ message: 'Load not found' });
        if (loadToUpdate.isCancelled) {
          return res.status(400).json({ message: 'Cancelled loads cannot be marked paid.' });
        }

        if (!Object.prototype.hasOwnProperty.call(req.body, 'isPaid')) {
          return res.status(400).json({ message: 'isPaid is required.' });
        }

        const updatedLoadData = {};
        const paidErr = applyLoadPaidFields(updatedLoadData, loadToUpdate, req.body);
        if (paidErr) return res.status(400).json({ message: paidErr });

        await loadToUpdate.update(updatedLoadData);
        res.json(loadToUpdate);
      } catch (err) {
        console.error('[SERVER] Error updating load paid status:', err);
        res.status(500).json({ message: 'Server error during load paid update' });
      }
    });

    // Cancel load (in-transit only — excluded from settlement / revenue projections)
    app.patch('/api/loads/:proNumber/cancel', authenticate, async (req, res) => {
      try {
        const { proNumber } = req.params;
        const { cancelReason, cancelReasonOther, unlinkFuelStops } = req.body;

        const loadToUpdate = await Loads.findOne({
          where: { proNumber, userId: req.userId },
        });
        if (!loadToUpdate) return res.status(404).json({ message: 'Load not found' });
        if (loadToUpdate.isCancelled) {
          return res.status(400).json({ message: 'Load is already cancelled.' });
        }
        if (loadToUpdate.dateDelivered) {
          return res.status(400).json({ message: 'Delivered loads cannot be cancelled.' });
        }
        if (!cancelReason || !isValidCancelReason(cancelReason)) {
          return res.status(400).json({ message: 'A valid cancellation reason is required.' });
        }
        const otherText =
          cancelReasonOther != null ? String(cancelReasonOther).trim() : '';
        if (cancelReason === 'other' && !otherText) {
          return res.status(400).json({
            message: 'Please specify a reason when selecting Other.',
          });
        }

        let unlinkedFuelStopCount = 0;
        let unlinkedFuelTotal = 0;
        if (unlinkFuelStops) {
          const attachedStops = await FuelStops.findAll({
            where: { proNumber, userId: req.userId },
          });
          unlinkedFuelStopCount = attachedStops.length;
          unlinkedFuelTotal = attachedStops.reduce(
            (sum, stop) => sum + (parseFloat(stop.totalFuelStop) || 0),
            0,
          );
          if (unlinkedFuelStopCount > 0) {
            await FuelStops.update(
              { proNumber: null },
              { where: { proNumber, userId: req.userId } },
            );
          }
        }

        await loadToUpdate.update({
          isCancelled: true,
          cancelReason,
          cancelReasonOther: cancelReason === 'other' ? otherText : null,
          cancelledAt: utcDateOnlyString(),
          isPaid: false,
          paidAt: null,
        });
        await loadToUpdate.reload();
        res.json({
          ...loadToUpdate.toJSON(),
          unlinkedFuelStopCount,
          unlinkedFuelTotal: Math.round(unlinkedFuelTotal * 100) / 100,
        });
      } catch (err) {
        console.error('[SERVER] Error cancelling load:', err);
        res.status(500).json({ message: 'Server error during load cancellation' });
      }
    });

    // Complete Load (Set dateDelivered to now)
    app.put('/api/loads/:proNumber/complete', authenticate, async (req, res) => {
      try {
        const load = await Loads.findOne({
          where: { proNumber: req.params.proNumber, userId: req.userId },
        });
        if (!load) return res.status(404).json({ message: 'Load not found' });
        if (load.isCancelled) {
          return res.status(400).json({ message: 'Cancelled loads cannot be completed.' });
        }
        if (load.dateDelivered) {
          return res.status(400).json({ message: 'Load already completed' });
        }
        const odoComplete = computeLoadOdometerDerived({
          startingOdometer: load.startingOdometer,
          loadedStartOdometer: load.loadedStartOdometer,
          endingOdometer: load.endingOdometer,
        });
        if (
          odoComplete.startingOdometer != null &&
          odoComplete.loadedStartOdometer != null &&
          odoComplete.endingOdometer != null &&
          odoComplete.invalidOrder
        ) {
          return res.status(400).json({
            message: 'Odometer readings must satisfy starting < pickup (loaded start) < ending.',
          });
        }
        load.dateDelivered = new Date(); // Set to current date and time
        await load.save();
        // console.log('[SERVER] Completed load:', load.proNumber);
        res.json(load);
      } catch (err) {
        console.error('[SERVER] Error completing load:', err);
        res.status(500).json({ message: 'Server error completing load' });
      }
    });

    // --- Fuel Stop Routes ---
    // Create Fuel Stop
    app.post('/api/fuelstops', authenticate, async (req, res) => {
      try {
        const {
          proNumber,
          dateOfStop,
          vendorName, // from frontend
          gallonsDieselPurchased, // Expecting camelCase from frontend
          pumpPriceDiesel,      // Expecting camelCase from frontend
          gallonsDefPurchased,  // Expecting camelCase from frontend (optional)
          pumpPriceDef,         // Expecting camelCase from frontend (optional)
          fuelCardUsed,         // New boolean field
          discountEligible,     // New boolean field
        } = req.body;

        // Validate required fields from the frontend payload
        const requiredFrontendFields = ['dateOfStop', 'vendorName', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
        for (const field of requiredFrontendFields) {
          const value = req.body[field];
          if (value === undefined || value === null || value === '') {
            // Allow 0 for numeric fields like gallonsDieselPurchased if that's valid
            if (typeof value === 'number' && value === 0 && field === 'gallonsDieselPurchased') continue;
            return res.status(400).json({ message: `Missing required field from payload: ${field}` });
          }
        }

        let resolvedProNumber;
        try {
          resolvedProNumber = await resolveOptionalFuelStopPro(Loads, proNumber, req.userId);
        } catch (proErr) {
          return res.status(proErr.status || 400).json({ message: proErr.message });
        }

        const gdp = parseFloat(gallonsDieselPurchased);
        const ppd = parseFloat(pumpPriceDiesel);
        // Apply discount conditionally
        const dieselDiscount = discountEligible ? 0.05 : 0;
        const costDieselPurchased = (ppd - dieselDiscount) * gdp;

        let totalDefCost = 0;
        if (gallonsDefPurchased && pumpPriceDef) {
          const gdefp = parseFloat(gallonsDefPurchased);
          const ppdef = parseFloat(pumpPriceDef);
          if (gdefp > 0 && ppdef > 0) { // Ensure both are positive numbers
            totalDefCost = ppdef * gdefp;
          }
        }
        let calculatedTotalFuelStopCost = costDieselPurchased + totalDefCost;
        // Add service charge if fuel card was used
        if (fuelCardUsed) {
          calculatedTotalFuelStopCost += 1.00;
        }

        let odometerParsed = null;
        if (req.body.odometerReading !== undefined && req.body.odometerReading !== null && req.body.odometerReading !== '') {
          const p = parseFloat(req.body.odometerReading);
          odometerParsed = Number.isNaN(p) ? null : p;
        }

        let previousOdometer = null;
        let calculatedMpg = null;
        if (odometerParsed != null) {
          const mpgResult = await computeMpgFromPreviousStop(FuelStops, {
            userId: req.userId,
            currentOdometer: odometerParsed,
            excludeFuelStopId: null,
            gallonsDiesel: gdp,
          });
          previousOdometer = mpgResult.previousOdometer;
          calculatedMpg = mpgResult.calculatedMpg;
        }

        // Map frontend payload and calculated values to the FuelStops model fields
        // Ensure your FuelStops model uses these camelCase field names
        const fuelStopData = {
          proNumber: resolvedProNumber,
          userId: req.userId,
          dateOfStop: new Date(dateOfStop), // Convert to Date object
          vendor: vendorName, // Map vendorName to 'vendor' model field
          gallonsDieselPurchased: gdp,
          dieselPricePerGallon: ppd,
          totalDieselCost: parseFloat(costDieselPurchased.toFixed(2)),
          gallonsDefPurchased: gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null,
          defPricePerGallon: pumpPriceDef ? parseFloat(pumpPriceDef) : null,
          totalDefCost: parseFloat(totalDefCost.toFixed(2)),
          totalFuelStop: parseFloat(calculatedTotalFuelStopCost.toFixed(2)),
          fuelCardUsed: !!fuelCardUsed, // Ensure boolean
          discountEligible: !!discountEligible, // Ensure boolean
          odometerReading: odometerParsed,
          previousOdometer: previousOdometer,
          calculatedMpg: calculatedMpg,
          settledDieselPricePerGallon: null, // Initialize as null for new fuel stops
          settledTotalDieselCost: null, // Initialize as null for new fuel stops
        };

        // console.log('[SERVER] Attempting to create FuelStop with data:', fuelStopData);
        const fuelStop = await FuelStops.create(fuelStopData);
        res.status(201).json(fuelStop);
      } catch (err) {
        console.error('[SERVER] Error creating fuel stop:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
        }
        res.status(500).json({ message: 'Server error while creating fuel stop' });
      }
    });

    // Get Fuel Stops (for the authenticated user, optionally filtered by proNumber)
    app.get('/api/fuelstops', authenticate, async (req, res) => {
      try {
        const { proNumber } = req.query; // Optional query parameter
        const whereClause = { userId: req.userId };
        if (proNumber) {
          whereClause.proNumber = proNumber;
        }
        const fuelStops = await FuelStops.findAll({
          where: whereClause,
          include: [{ model: Loads, as: 'load', attributes: ['proNumber', 'originCity', 'destinationCity'] }],
          order: [['dateOfStop', 'DESC']], // Show newest first
        });
        res.json(fuelStops);
      } catch (err) {
        console.error('[SERVER] Error fetching fuel stops:', err);
        res.status(500).json({ message: 'Server error fetching fuel stops' });
      }
    });

    // Update Fuel Stop
    app.put('/api/fuelstops/:id', authenticate, async (req, res) => {
      try {
        const fuelStopId = req.params.id;
        const fuelStop = await FuelStops.findOne({ where: { id: fuelStopId, userId: req.userId } });

        if (!fuelStop) {
          return res.status(404).json({ message: 'Fuel stop not found or access denied' });
        }

        const {
          proNumber,
          dateOfStop,
          vendorName, // from frontend
          gallonsDieselPurchased, // Expecting camelCase
          pumpPriceDiesel,      // Expecting camelCase
          gallonsDefPurchased,  // Expecting camelCase
          pumpPriceDef,         // Expecting camelCase
          fuelCardUsed,         // New boolean field
          discountEligible,     // New boolean field
          odometerReading,
        } = req.body;

        // Construct updateData carefully, only including fields that are present in req.body
        const updateData = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'proNumber')) {
          try {
            updateData.proNumber = await resolveOptionalFuelStopPro(Loads, proNumber, req.userId);
          } catch (proErr) {
            return res.status(proErr.status || 400).json({ message: proErr.message });
          }
        }
        if (dateOfStop !== undefined) updateData.dateOfStop = new Date(dateOfStop);
        if (vendorName !== undefined) updateData.vendor = vendorName; // Map to model field 'vendor'

        // Determine values to use for calculation (either new from req.body or existing from fuelStop)
        const gdpToUse = gallonsDieselPurchased !== undefined ? parseFloat(gallonsDieselPurchased) : fuelStop.gallonsDieselPurchased;
        const ppdToUse = pumpPriceDiesel !== undefined ? parseFloat(pumpPriceDiesel) : fuelStop.dieselPricePerGallon;

        // Only add to updateData if they were actually provided in the request
        if (gallonsDieselPurchased !== undefined) updateData.gallonsDieselPurchased = gdpToUse;
        if (pumpPriceDiesel !== undefined) updateData.dieselPricePerGallon = ppdToUse;

        const effectiveDiscountEligible = discountEligible !== undefined ? discountEligible : fuelStop.discountEligible;
        const dieselDiscount = effectiveDiscountEligible ? 0.05 : 0;
        const costDieselPurchased = (ppdToUse - dieselDiscount) * gdpToUse; // Recalculate with conditional discount
        updateData.totalDieselCost = parseFloat(costDieselPurchased.toFixed(2));

        let costDef = 0;
        // Handle DEF values: if sent as null, use null; if sent as value, use value; otherwise, use existing.
        const gdefpToUse = gallonsDefPurchased !== undefined
          ? (gallonsDefPurchased === null ? null : parseFloat(gallonsDefPurchased))
          : fuelStop.gallonsDefPurchased;
        const ppdefToUse = pumpPriceDef !== undefined
          ? (pumpPriceDef === null ? null : parseFloat(pumpPriceDef))
          : fuelStop.defPricePerGallon;

        if (gallonsDefPurchased !== undefined) updateData.gallonsDefPurchased = gdefpToUse;
        if (pumpPriceDef !== undefined) updateData.defPricePerGallon = ppdefToUse;

        if (gdefpToUse && ppdefToUse && gdefpToUse > 0 && ppdefToUse > 0) {
          costDef = ppdefToUse * gdefpToUse; // Recalculate
        }
        updateData.totalDefCost = parseFloat(costDef.toFixed(2));

        let calculatedTotalFuelStopCost = costDieselPurchased + costDef;
        const effectiveFuelCardUsed = fuelCardUsed !== undefined ? fuelCardUsed : fuelStop.fuelCardUsed;
        if (effectiveFuelCardUsed) {
          calculatedTotalFuelStopCost += 1.00;
        }
        updateData.totalFuelStop = parseFloat(calculatedTotalFuelStopCost.toFixed(2)); // Recalculate
        if (fuelCardUsed !== undefined) updateData.fuelCardUsed = !!fuelCardUsed;
        if (discountEligible !== undefined) updateData.discountEligible = !!discountEligible;

        const odometerInBody = odometerReading !== undefined;
        const gallonsInBody = gallonsDieselPurchased !== undefined;

        if (odometerInBody) {
          if (odometerReading === null || odometerReading === '') {
            updateData.odometerReading = null;
            updateData.previousOdometer = null;
            updateData.calculatedMpg = null;
          } else {
            const parsedOd = parseFloat(odometerReading);
            updateData.odometerReading = Number.isNaN(parsedOd) ? null : parsedOd;
          }
        }

        const effectiveOdometer =
          updateData.odometerReading !== undefined ? updateData.odometerReading : fuelStop.odometerReading;
        const shouldRecalcMpg =
          (odometerInBody && updateData.odometerReading != null) ||
          (gallonsInBody &&
            effectiveOdometer != null &&
            !Number.isNaN(parseFloat(effectiveOdometer)));

        if (shouldRecalcMpg) {
          const mpgResult = await computeMpgFromPreviousStop(FuelStops, {
            userId: req.userId,
            currentOdometer: effectiveOdometer,
            excludeFuelStopId: fuelStop.id,
            gallonsDiesel: gdpToUse,
          });
          updateData.previousOdometer = mpgResult.previousOdometer;
          updateData.calculatedMpg = mpgResult.calculatedMpg;
        }

        await fuelStop.update(updateData);
        res.json(fuelStop);
      } catch (err) {
        console.error('[SERVER] Error updating fuel stop:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
        }
        res.status(500).json({ message: 'Server error updating fuel stop' });
      }
    });

    // Delete Fuel Stop
    app.delete('/api/fuelstops/:id', authenticate, async (req, res) => {
      try {
        const fuelStopId = req.params.id;
        const fuelStop = await FuelStops.findOne({ where: { id: fuelStopId, userId: req.userId } });

        if (!fuelStop) {
          return res.status(404).json({ message: 'Fuel stop not found or access denied' });
        }

        await fuelStop.destroy();
        res.status(200).json({ message: 'Fuel stop deleted successfully' });
      } catch (err) {
        console.error('[SERVER] Error deleting fuel stop:', err);
        res.status(500).json({ message: 'Server error deleting fuel stop' });
      }
    });

    // Settle Fuel Stop (Update settled diesel price and recalculate settled total)
    app.put('/api/fuelstops/:id/settle', authenticate, async (req, res) => {
      try {
        const fuelStopId = req.params.id;
        const { settledDieselPricePerGallon } = req.body;

        if (settledDieselPricePerGallon === undefined) {
          return res.status(400).json({ message: 'settledDieselPricePerGallon is required' });
        }

        const settledPrice = parseFloat(settledDieselPricePerGallon);
        if (isNaN(settledPrice) || settledPrice < 0) {
          return res.status(400).json({ message: 'Invalid settledDieselPricePerGallon. Must be a non-negative number.' });
        }

        const fuelStop = await FuelStops.findOne({ where: { id: fuelStopId, userId: req.userId } });

        if (!fuelStop) {
          return res.status(404).json({ message: 'Fuel stop not found or access denied' });
        }

        // Calculate settled total based on gallons purchased and settled price
        const settledTotalDieselCost = fuelStop.gallonsDieselPurchased * settledPrice;

        await fuelStop.update({
          settledDieselPricePerGallon: settledPrice,
          settledTotalDieselCost: parseFloat(settledTotalDieselCost.toFixed(2))
        });

        res.json(fuelStop);
      } catch (err) {
        console.error('[SERVER] Error settling fuel stop:', err);
        res.status(500).json({ message: 'Server error settling fuel stop' });
      }
    });

    // --- User Settings Routes ---
    // GET current user's settings
    app.get('/api/users/settings', authenticate, async (req, res) => {
      try {
        let settings = await UserSettings.findOne({ where: { userId: req.userId } });
        if (!settings) {
          // If no settings exist, create default settings for the user based on model defaults
          // console.log(`[SERVER] No settings found for userId: ${req.userId}. Creating default settings.`);
          settings = await UserSettings.create({ userId: req.userId });
        }
        const plain = settings.get({ plain: true });
        res.json({
          ...plain,
          fixedExpenses: mergeFixedExpensesForRead(plain.fixedExpenses),
        });
      } catch (err) {
        console.error('[SERVER] Error fetching user settings:', err);
        res.status(500).json({ message: 'Error fetching user settings' });
      }
    });

    // PUT (update/create) user's settings
    app.put('/api/users/settings', authenticate, async (req, res) => {
      try {
        const {
          driverPayType,
          percentageRate, // Expected as decimal e.g., 0.68 for 68%
          fuelRoadUseTax,   // Expected as decimal e.g., 0.05 for 5 cents/mile
          maintenanceReserve,
          bondDeposit,
          mrpFee
        } = req.body;

        const updateData = {};

        if (driverPayType !== undefined) {
          if (!['percentage', 'mileage'].includes(driverPayType)) {
            return res.status(400).json({ message: 'Invalid driverPayType' });
          }
          updateData.driverPayType = driverPayType;
          // If switching to mileage, explicitly nullify percentageRate
          if (driverPayType === 'mileage') {
            updateData.percentageRate = null;
          }
        }

        if (percentageRate !== undefined) {
          // Allow null to clear the rate if switching away from percentage,
          // or if user wants to clear it while on percentage (though UI might prevent this)
          if (percentageRate === null) {
            updateData.percentageRate = null;
          } else {
            const rate = parseFloat(percentageRate);
            if (isNaN(rate) || rate < 0 || rate > 1) {
              return res.status(400).json({ message: 'Invalid percentageRate. Must be a decimal between 0 and 1, or null.' });
            }
            updateData.percentageRate = rate;
          }
        }

        const otherFloatSettings = {
          fuelRoadUseTax,
          maintenanceReserve,
          bondDeposit,
          mrpFee
        };

        for (const key in otherFloatSettings) {
          const value = otherFloatSettings[key];
          if (value !== undefined) {
            if (value === null) { // Allow explicitly setting to null
              updateData[key] = null;
            } else {
              const numValue = parseFloat(value);
              if (isNaN(numValue)) {
                return res.status(400).json({ message: `Invalid value for ${key}. Must be a number or null.` });
              }
              // Add specific range validation if necessary, e.g., if (numValue < 0)
              updateData[key] = numValue;
            }
          }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'fixedExpenses')) {
          const existingRow = await UserSettings.findOne({ where: { userId: req.userId } });
          const existingJson = existingRow ? existingRow.fixedExpenses : null;
          try {
            if (req.body.fixedExpenses === null) {
              updateData.fixedExpenses = null;
            } else {
              updateData.fixedExpenses = normalizeFixedExpensesInput(
                req.body.fixedExpenses,
                existingJson
              );
            }
          } catch (e) {
            if (e.code === 'INVALID_FIXED_EXPENSE') {
              return res.status(400).json({ message: e.message || 'Invalid fixed expense value.' });
            }
            throw e;
          }
        }

        // Upsert ensures record is created if not found, or updated if found.
        const [settings] = await UserSettings.upsert(
          { userId: req.userId, ...updateData },
          { returning: true } // Ensures the updated/created record is returned
        );
        // upsert might return an array [instance, createdBoolean] or just instance depending on dialect/version
        const resultSettings = Array.isArray(settings) ? settings[0] : settings;
        const plainOut = resultSettings.get ? resultSettings.get({ plain: true }) : resultSettings;
        res.json({
          ...plainOut,
          fixedExpenses: mergeFixedExpensesForRead(plainOut.fixedExpenses),
        });
      } catch (err) {
        console.error('[SERVER] Error updating user settings:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        res.status(500).json({ message: 'Error updating user settings' });
      }
    });

    async function upsertVendorForExpense(userId, body, { transaction } = {}) {
      const name = (body.vendorName || '').trim();
      if (!name) {
        const err = new Error('Vendor name is required');
        err.code = 'VENDOR_NAME';
        throw err;
      }
      const norm = (s) => {
        if (s === undefined || s === null) return null;
        const t = String(s).trim();
        return t === '' ? null : t;
      };
      const addressStreet = norm(body.addressStreet);
      const city = norm(body.city);
      const state = norm(body.state);
      const zip = norm(body.zip);
      const phone = norm(body.phone);

      const existing = await Vendor.findOne({
        where: {
          userId,
          [Op.and]: where(fn('LOWER', col('name')), Op.eq, name.toLowerCase()),
        },
        transaction,
      });

      if (existing) {
        const patch = {};
        if (addressStreet !== null) patch.addressStreet = addressStreet;
        if (city !== null) patch.city = city;
        if (state !== null) patch.state = state;
        if (zip !== null) patch.zip = zip;
        if (phone !== null) patch.phone = phone;
        if (Object.keys(patch).length) await existing.update(patch, { transaction });
        return existing;
      }

      return Vendor.create({
        userId,
        name,
        addressStreet,
        city,
        state,
        zip,
        phone,
      }, { transaction });
    }

    function parseOfficeExpenseLine(raw) {
      const category = typeof raw.category === 'string' ? raw.category.trim() : '';
      if (!ALLOWED_OFFICE_EXPENSE_CATEGORY_VALUES.has(category)) {
        return { error: 'Choose a valid category.' };
      }
      const description = typeof raw.description === 'string' ? raw.description.trim() : '';
      if (!description) {
        return { error: 'Item description is required.' };
      }
      const qty = parseFloat(raw.quantity);
      const ind = parseFloat(raw.individualPrice);
      if (Number.isNaN(qty) || qty <= 0) {
        return { error: 'Quantity must be a positive number.' };
      }
      if (Number.isNaN(ind) || ind < 0) {
        return { error: 'Individual price must be a non-negative number.' };
      }
      let extended;
      const ep = raw.extendedPrice;
      if (ep !== undefined && ep !== null && ep !== '') {
        extended = parseFloat(ep);
        if (Number.isNaN(extended) || extended < 0) {
          return { error: 'Extended price must be a non-negative number.' };
        }
      } else {
        extended = Math.round(qty * ind * 100) / 100;
      }
      return {
        ok: true,
        qty,
        ind,
        extended,
        description,
        category,
      };
    }

    function unlinkReceiptIfExists(relativeKey) {
      if (!relativeKey) return;
      const abs = receiptStorage.resolveReceiptAbsolutePath(relativeKey);
      if (abs && fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch (e) {
          console.warn('[RECEIPT] Could not delete old file:', e.message);
        }
      }
    }

    function officeExpenseMultipart(req, res, next) {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('multipart/form-data')) {
        return uploadReceiptMemory.single('receipt')(req, res, (err) => {
          if (err) {
            return res.status(400).json({ message: err.message || 'File upload failed' });
          }
          next();
        });
      }
      next();
    }

    app.get('/api/vendors', authenticate, async (req, res) => {
      try {
        const vendors = await Vendor.findAll({
          where: { userId: req.userId },
          order: [['name', 'ASC']],
        });
        res.json(vendors);
      } catch (err) {
        console.error('[SERVER] Error listing vendors:', err);
        res.status(500).json({ message: 'Error listing vendors' });
      }
    });

    app.get('/api/office-expenses', authenticate, async (req, res) => {
      try {
        const rows = await OfficeExpense.findAll({
          where: { userId: req.userId },
          include: [{ model: Vendor, as: 'vendor' }],
          order: [['createdAt', 'DESC']],
        });
        res.json(rows);
      } catch (err) {
        console.error('[SERVER] Error listing office expenses:', err);
        res.status(500).json({ message: 'Error listing office expenses' });
      }
    });

    app.post('/api/office-expenses', authenticate, officeExpenseMultipart, async (req, res) => {
      try {
        let body = req.body;
        if ((req.headers['content-type'] || '').includes('multipart/form-data')) {
          body = { ...req.body };
          if (typeof body.items === 'string') {
            try {
              body.items = JSON.parse(body.items);
            } catch (e) {
              return res.status(400).json({ message: 'Invalid items JSON in multipart request.' });
            }
          }
        }

        const purchaseDate = body.purchaseDate || null;

        let lineInputs;
        if (Array.isArray(body.items)) {
          if (body.items.length === 0) {
            return res.status(400).json({ message: 'At least one line item is required.' });
          }
          lineInputs = body.items;
        } else {
          lineInputs = [{
            quantity: body.quantity,
            individualPrice: body.individualPrice,
            extendedPrice: body.extendedPrice,
            description: body.description,
            category: body.category,
          }];
        }

        if (!body.vendorName || !String(body.vendorName).trim()) {
          return res.status(400).json({ message: 'Vendor name is required.' });
        }

        let receiptTax = parseFloat(body.tax);
        if (Number.isNaN(receiptTax)) receiptTax = 0;
        if (receiptTax < 0) {
          return res.status(400).json({ message: 'Tax must be a non-negative number.' });
        }

        const parsedLines = [];
        for (let i = 0; i < lineInputs.length; i++) {
          const p = parseOfficeExpenseLine(lineInputs[i]);
          if (p.error) {
            const suffix = lineInputs.length > 1 ? ` (line ${i + 1})` : '';
            return res.status(400).json({ message: `${p.error}${suffix}` });
          }
          parsedLines.push(p);
        }

        const receiptFile = req.file;
        if (receiptFile && !receiptStorage.allowedReceiptMime(receiptFile.mimetype, receiptFile.originalname)) {
          return res.status(400).json({ message: 'Receipt must be a PDF or image file.' });
        }

        const createdIds = await sequelize.transaction(async (t) => {
          const vendor = await upsertVendorForExpense(req.userId, {
            vendorName: body.vendorName,
            addressStreet: body.addressStreet,
            city: body.city,
            state: body.state,
            zip: body.zip,
            phone: body.phone,
          }, { transaction: t });

          const ids = [];
          const lastIdx = parsedLines.length - 1;
          for (let i = 0; i < parsedLines.length; i++) {
            const p = parsedLines[i];
            const taxForLine = i === lastIdx ? receiptTax : 0;
            const total = Math.round((p.extended + taxForLine) * 100) / 100;
            const expense = await OfficeExpense.create({
              userId: req.userId,
              vendorId: vendor.id,
              quantity: p.qty,
              individualPrice: p.ind,
              extendedPrice: p.extended,
              tax: taxForLine,
              total,
              purchaseDate,
              description: p.description,
              category: p.category,
            }, { transaction: t });
            ids.push(expense.id);
          }

          if (receiptFile && receiptFile.buffer && receiptFile.buffer.length) {
            const receiptKey = receiptStorage.saveReceiptBuffer({
              userId: req.userId,
              transactionDate: purchaseDate || new Date(),
              vendorName: body.vendorName,
              buffer: receiptFile.buffer,
              mimeType: receiptFile.mimetype,
              originalName: receiptFile.originalname,
            });
            await OfficeExpense.update(
              { receiptFileKey: receiptKey },
              { where: { id: { [Op.in]: ids }, userId: req.userId }, transaction: t },
            );
          }
          return ids;
        });

        const items = await OfficeExpense.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: [{ model: Vendor, as: 'vendor' }],
          order: [['id', 'ASC']],
        });
        res.status(201).json({ items });
      } catch (err) {
        console.error('[SERVER] Error creating office expense:', err);
        if (err.code === 'VENDOR_NAME') {
          return res.status(400).json({ message: err.message });
        }
        if (err.code === 'EMPTY_FILE') {
          return res.status(400).json({ message: 'Receipt file was empty.' });
        }
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        res.status(500).json({ message: 'Error saving office expense' });
      }
    });

    app.post('/api/receipts', authenticate, uploadReceiptMemory.single('file'), async (req, res) => {
      try {
        const { targetType, targetId } = req.body;
        if (!req.file || !req.file.buffer || !req.file.buffer.length) {
          return res.status(400).json({ message: 'file is required.' });
        }
        if (!receiptStorage.allowedReceiptMime(req.file.mimetype, req.file.originalname)) {
          return res.status(400).json({ message: 'File must be PDF or an image.' });
        }
        const tid = parseInt(targetId, 10);
        if (Number.isNaN(tid)) {
          return res.status(400).json({ message: 'targetId must be a number.' });
        }

        if (targetType === 'fuel_stop') {
          const fuelStop = await FuelStops.findOne({ where: { id: tid, userId: req.userId } });
          if (!fuelStop) {
            return res.status(404).json({ message: 'Fuel stop not found.' });
          }
          unlinkReceiptIfExists(fuelStop.receiptFileKey);
          const key = receiptStorage.saveReceiptBuffer({
            userId: req.userId,
            transactionDate: fuelStop.dateOfStop,
            vendorName: fuelStop.vendor,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
          });
          await fuelStop.update({ receiptFileKey: key });
          const updated = await FuelStops.findByPk(fuelStop.id);
          return res.status(201).json({ receiptFileKey: key, row: updated });
        }

        if (targetType === 'office_expense') {
          const row = await OfficeExpense.findOne({
            where: { id: tid, userId: req.userId },
            include: [{ model: Vendor, as: 'vendor' }],
          });
          if (!row) {
            return res.status(404).json({ message: 'Office expense not found.' });
          }
          unlinkReceiptIfExists(row.receiptFileKey);
          const vendorName = row.vendor?.name || 'vendor';
          const key = receiptStorage.saveReceiptBuffer({
            userId: req.userId,
            transactionDate: row.purchaseDate || row.createdAt,
            vendorName,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
          });
          await row.update({ receiptFileKey: key });
          const updated = await OfficeExpense.findByPk(row.id, {
            include: [{ model: Vendor, as: 'vendor' }],
          });
          return res.status(201).json({ receiptFileKey: key, row: updated });
        }

        return res.status(400).json({ message: 'targetType must be fuel_stop or office_expense.' });
      } catch (err) {
        console.error('[SERVER] Error attaching receipt:', err);
        if (err.code === 'EMPTY_FILE') {
          return res.status(400).json({ message: 'Empty file.' });
        }
        res.status(500).json({ message: 'Error saving receipt' });
      }
    });

    app.get('/api/receipts/download', authenticate, async (req, res) => {
      try {
        const { targetType, targetId } = req.query;
        const tid = parseInt(targetId, 10);
        if (Number.isNaN(tid)) {
          return res.status(400).json({ message: 'targetId required' });
        }
        let relativeKey = null;
        let downloadName = 'receipt.pdf';

        if (targetType === 'fuel_stop') {
          const fuelStop = await FuelStops.findOne({ where: { id: tid, userId: req.userId } });
          if (!fuelStop || !fuelStop.receiptFileKey) {
            return res.status(404).json({ message: 'Receipt not found.' });
          }
          relativeKey = fuelStop.receiptFileKey;
          const stamp = receiptStorage.dateStamp(fuelStop.dateOfStop);
          downloadName = `${stamp}_${receiptStorage.slugVendor(fuelStop.vendor)}${path.extname(relativeKey) || '.pdf'}`;
        } else if (targetType === 'office_expense') {
          const row = await OfficeExpense.findOne({
            where: { id: tid, userId: req.userId },
            include: [{ model: Vendor, as: 'vendor' }],
          });
          if (!row || !row.receiptFileKey) {
            return res.status(404).json({ message: 'Receipt not found.' });
          }
          relativeKey = row.receiptFileKey;
          const stamp = receiptStorage.dateStamp(row.purchaseDate || row.createdAt);
          downloadName = `${stamp}_${receiptStorage.slugVendor(row.vendor?.name)}${path.extname(relativeKey) || '.pdf'}`;
        } else {
          return res.status(400).json({ message: 'Invalid targetType' });
        }

        const absPath = receiptStorage.resolveReceiptAbsolutePath(relativeKey);
        if (!absPath || !fs.existsSync(absPath)) {
          return res.status(404).json({ message: 'File missing on server.' });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"`);
        return res.sendFile(absPath);
      } catch (err) {
        console.error('[SERVER] Receipt download error:', err);
        res.status(500).json({ message: 'Error downloading receipt' });
      }
    });

    // --- Bug Reporting Endpoint ---
    app.post('/api/report-bug', authenticate, async (req, res) => { // `authenticate` to get userId
      try {
        const {
          description,
          stepsToReproduce,
          contactEmail,
          url,
          userAgent,
          appVersion
        } = req.body;

        if (!description || !stepsToReproduce) {
          return res.status(400).json({ message: 'Description and steps to reproduce are required.' });
        }

        const userId = req.userId || 'anonymous'; // Get userId from token if available
        const report = {
          userId,
          timestamp: new Date().toISOString(),
          description,
          stepsToReproduce,
          contactEmail: contactEmail || 'Not provided',
          url,
          userAgent,
          appVersion,
        };

        // Save to database using the BugReport model
        const newBugReport = await BugReport.create({
          userId: userId === 'anonymous' ? null : userId, // Store null if anonymous
          description,
          stepsToReproduce,
          contactEmail: contactEmail || null,
          url,
          userAgent,
          appVersion,
          status: 'new', // Default status
          // timestamp (createdAt) is handled by Sequelize
        });

        console.log('[BUG-REPORT] New bug report saved to DB. ID:', newBugReport.id);

        // Optional: Still log to console or file if desired for immediate visibility
        // console.log('[BUG-REPORT] Details:', JSON.stringify(newBugReport.toJSON(), null, 2));

        // Respond to the client
        res.status(200).json({ message: 'Bug report submitted successfully.' });
      } catch (err) {
        console.error('[SERVER] Error in /api/report-bug endpoint:', err);
        res.status(500).json({ message: 'Failed to submit bug report on server.' });
      }
    });

    // --- Client-Side Error Logging Endpoint ---
    app.post('/api/client-log', authenticate, async (req, res) => { // `authenticate` makes it user-specific
      try {
        const errorDetails = req.body;
        const userId = req.userId || 'anonymous'; // Get userId from token if available

        // Log to console (basic)
        console.error(`[CLIENT-ERROR] UserID: ${userId}, Timestamp: ${new Date().toISOString()}`, errorDetails);

        // Optional: Log to a file (more persistent)
        // const logEntry = `Timestamp: ${new Date().toISOString()}, UserID: ${userId}, Error: ${JSON.stringify(errorDetails, null, 2)}\n---\n`;
        // fs.appendFile('client_errors.log', logEntry, (err) => {
        //   if (err) console.error('[SERVER] Failed to write to client_errors.log:', err);
        // });

        res.status(200).json({ message: 'Error logged successfully' });
      } catch (err) {
        // This catch is for errors in the logging endpoint itself
        console.error('[SERVER] Error in /api/client-log endpoint:', err);
        res.status(500).json({ message: 'Failed to log error on server' });
      }
    });

    const healthReady = async (req, res) => {
      try {
        await sequelize.authenticate();
        res.json({ status: 'ready' });
      } catch (err) {
        res.status(503).json({ status: 'not_ready', message: err.message });
      }
    };
    app.get('/api/health/ready', healthReady);
    app.get('/health/ready', healthReady);

    if (process.env.SERVE_STATIC === 'true' || process.env.SERVE_STATIC === '1') {
      const distPath = path.resolve(__dirname, '..', 'interface', 'dist');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        app.use(express.static(distPath, { index: false }));
        app.get('*', (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next();
          if (req.path.startsWith('/api')) return next();
          res.sendFile(indexPath, (err) => {
            if (err) next(err);
          });
        });
        console.log('[SERVER] Serving frontend static assets from', distPath);
      } else {
        console.warn('[SERVER] SERVE_STATIC is set but frontend build not found at', distPath);
      }
    }

    console.log('[SERVER] Database ready; API routes are active.');

  } catch (error) {
    // This catch is for errors during dbPromise resolution or critical setup errors
    // before the server routes are even defined.
    console.error('[SERVER] FATAL: Failed to initialize database or start server:', error);
    process.exit(1); // Exit if server cannot start
  }
}

// Call the async function to start the application.
startServer();
