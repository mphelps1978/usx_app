// server.js
require('dotenv').config(); // Load environment variables at the very beginning
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Import bcrypt
// Import the promise from db.js which will resolve with models and sequelize
const dbPromise = require('./db');
const { Op } = require('sequelize'); // Sequelize Op can be required directly

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Wrap the server setup and start logic in an async function
async function startServer() {
  try {
    // Await the promise from db.js to get the initialized models and sequelize instance
    const { User, Loads, FuelStops, UserSettings, sequelize } = await dbPromise;

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
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        const user = await User.create({ username, email, password: hashedPassword });
        // Generate a token for the new user to log them in immediately
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
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

    // Login
    app.post('/api/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });
        // Compare hashed password
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
      } catch (err) {
        console.error('[SERVER] Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
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
            },
          });
          if (existingActiveLoad) {
            return res.status(409).json({
              message: 'An active load already exists. Please complete it before adding a new active load.'
            });
          }
        }

        const baseRequiredFields = ['proNumber', 'dateDispatched', 'originCity', 'originState',
          'destinationCity', 'destinationState', 'deadheadMiles', 'loadedMiles', 'weight', 'driverPayType'];
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

        // console.log('[SERVER] Creating load with data:', loadData);
        const load = await Loads.create(loadData);
        res.status(201).json(load);
      } catch (err) {
        console.error('[SERVER] Error creating load:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        if (err.name === 'SequelizeUniqueConstraintError') {
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

        const {
          driverPayType, // Will be undefined if not sent, handled below
          linehaul,
          fsc,
          fscPerLoadedMile,
          calculatedGross,
          projectedNet,
          scaleCost,
          ...restOfBody
        } = req.body;

        const updatedLoadData = { ...restOfBody };

        // Only update fields if they are explicitly provided in the request body
        if (driverPayType !== undefined) updatedLoadData.driverPayType = driverPayType;
        if (calculatedGross !== undefined) updatedLoadData.calculatedGross = calculatedGross;
        if (projectedNet !== undefined) updatedLoadData.projectedNet = projectedNet;
        if (scaleCost !== undefined) updatedLoadData.scaleCost = scaleCost;

        if (req.body.hasOwnProperty('dateDelivered')) { // Check if dateDelivered was intentionally sent
          updatedLoadData.dateDelivered = req.body.dateDelivered &&
            req.body.dateDelivered !== 'Invalid date' &&
            !isNaN(new Date(req.body.dateDelivered).getTime())
            ? new Date(req.body.dateDelivered)
            : null;
        }


        // If trying to set the load as active (dateDelivered is null)
        if (updatedLoadData.dateDelivered === null) {
          const otherActiveLoad = await Loads.findOne({
            where: {
              userId: req.userId,
              dateDelivered: null,
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

        // console.log('[SERVER] Updating load with data:', updatedLoadData);
        await loadToUpdate.update(updatedLoadData);
        res.json(loadToUpdate);
      } catch (err) {
        console.error('[SERVER] Error updating load:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        res.status(500).json({ message: 'Server error during load update' });
      }
    });

    // Complete Load (Set dateDelivered to now)
    app.put('/api/loads/:proNumber/complete', authenticate, async (req, res) => {
      try {
        const load = await Loads.findOne({
          where: { proNumber: req.params.proNumber, userId: req.userId },
        });
        if (!load) return res.status(404).json({ message: 'Load not found' });
        if (load.dateDelivered) {
          return res.status(400).json({ message: 'Load already completed' });
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
          location,
          gallonsDieselPurchased, // Expecting camelCase from frontend
          pumpPriceDiesel,      // Expecting camelCase from frontend
          gallonsDefPurchased,  // Expecting camelCase from frontend (optional)
          pumpPriceDef,         // Expecting camelCase from frontend (optional)
          fuelCardUsed,         // New boolean field
          discountEligible,     // New boolean field
        } = req.body;

        // Validate required fields from the frontend payload
        const requiredFrontendFields = ['proNumber', 'dateOfStop', 'vendorName', 'location', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
        for (const field of requiredFrontendFields) {
          const value = req.body[field];
          if (value === undefined || value === null || value === '') {
            // Allow 0 for numeric fields like gallonsDieselPurchased if that's valid
            if (typeof value === 'number' && value === 0 && field === 'gallonsDieselPurchased') continue;
            return res.status(400).json({ message: `Missing required field from payload: ${field}` });
          }
        }

        // Check if the associated load exists and belongs to the user
        const load = await Loads.findOne({ where: { proNumber, userId: req.userId } });
        if (!load) {
          return res.status(404).json({ message: 'Associated load not found or access denied.' });
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

        // Map frontend payload and calculated values to the FuelStops model fields
        // Ensure your FuelStops model uses these camelCase field names
        const fuelStopData = {
          proNumber,
          userId: req.userId,
          dateOfStop: new Date(dateOfStop), // Convert to Date object
          vendor: vendorName, // Map vendorName to 'vendor' model field
          location: location,
          gallonsDieselPurchased: gdp,
          dieselPricePerGallon: ppd,
          totalDieselCost: parseFloat(costDieselPurchased.toFixed(2)),
          gallonsDefPurchased: gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null,
          defPricePerGallon: pumpPriceDef ? parseFloat(pumpPriceDef) : null,
          totalDefCost: parseFloat(totalDefCost.toFixed(2)),
          totalFuelStop: parseFloat(calculatedTotalFuelStopCost.toFixed(2)),
          fuelCardUsed: !!fuelCardUsed, // Ensure boolean
          discountEligible: !!discountEligible, // Ensure boolean
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
          dateOfStop,
          vendorName, // from frontend
          location,
          gallonsDieselPurchased, // Expecting camelCase
          pumpPriceDiesel,      // Expecting camelCase
          gallonsDefPurchased,  // Expecting camelCase
          pumpPriceDef,         // Expecting camelCase
          fuelCardUsed,         // New boolean field
          discountEligible,     // New boolean field
        } = req.body;

        // Construct updateData carefully, only including fields that are present in req.body
        const updateData = {};
        if (dateOfStop !== undefined) updateData.dateOfStop = new Date(dateOfStop);
        if (vendorName !== undefined) updateData.vendor = vendorName; // Map to model field 'vendor'
        if (location !== undefined) updateData.location = location;

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
        res.json(settings);
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

        // Upsert ensures record is created if not found, or updated if found.
        const [settings] = await UserSettings.upsert(
          { userId: req.userId, ...updateData },
          { returning: true } // Ensures the updated/created record is returned
        );
        // upsert might return an array [instance, createdBoolean] or just instance depending on dialect/version
        const resultSettings = Array.isArray(settings) ? settings[0] : settings;

        res.json(resultSettings);
      } catch (err) {
        console.error('[SERVER] Error updating user settings:', err);
        if (err.name === 'SequelizeValidationError') {
          return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
        }
        res.status(500).json({ message: 'Error updating user settings' });
      }
    });

    // Start the Express server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`[SERVER] Server running on port ${PORT} after DB initialization.`));

  } catch (error) {
    // This catch is for errors during dbPromise resolution or critical setup errors
    // before the server routes are even defined.
    console.error('[SERVER] FATAL: Failed to initialize database or start server:', error);
    process.exit(1); // Exit if server cannot start
  }
}

// Call the async function to start the application.
startServer();
