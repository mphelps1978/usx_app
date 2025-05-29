// server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { User, Loads, FuelStops, UserSettings, sequelize } = require('./db');
const { Op } = require('sequelize');
require('dotenv').config();

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No token provided'); // Debug
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token validated, userId:', decoded.userId); // Debug
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('Invalid token:', err.message); // Debug
    res.status(401).json({ message: 'Invalid token' });
  }
};

console.log('FuelStops model in server.js:', FuelStops);

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.create({ username, email, password });
    res.status(201).json({ message: 'User registered', userId: user.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(400).json({ message: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Loads
app.get('/api/loads', authenticate, async (req, res) => {
  try {
    console.log('Fetching loads for user:', req.userId);
    const loads = await Loads.findAll({ where: { userId: req.userId } });
    res.json(loads);
  } catch (err) {
    console.error('Error fetching loads:', err);
    res.status(500).json({ message: 'Server error' });
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
      calculatedGross, // from frontend
      projectedNet,  // from frontend
      scaleCost,     // from frontend
      ...restOfBody
    } = req.body;

    const loadData = { ...restOfBody, userId: req.userId, driverPayType, calculatedGross, projectedNet, scaleCost };

    loadData.dateDelivered = loadData.dateDelivered &&
      loadData.dateDelivered !== 'Invalid date' &&
      !isNaN(new Date(loadData.dateDelivered).getTime())
      ? new Date(loadData.dateDelivered)
      : null;

    if (!loadData.dateDelivered) {
      const existingActiveLoad = await Loads.findOne({
        where: {
          userId: req.userId,
          dateDelivered: null,
          // proNumber: { [Op.ne]: loadData.proNumber } // No proNumber on create yet
        },
      });
      if (existingActiveLoad) {
        return res.status(409).json({
          message: 'An active load already exists. Please complete it before adding a new active load.'
        });
      }
    }

    // Base required fields
    const baseRequiredFields = ['proNumber', 'dateDispatched', 'originCity', 'originState',
      'destinationCity', 'destinationState', 'deadheadMiles', 'loadedMiles', 'weight', 'driverPayType'];

    let allRequiredFields = [...baseRequiredFields];

    if (driverPayType === 'percentage') {
      allRequiredFields.push('linehaul', 'fsc');
      loadData.linehaul = linehaul;
      loadData.fsc = fsc;
      loadData.fscPerLoadedMile = null; // Ensure other type specific field is null
    } else if (driverPayType === 'mileage') {
      allRequiredFields.push('fscPerLoadedMile');
      loadData.fscPerLoadedMile = fscPerLoadedMile;
      loadData.linehaul = null; // Ensure other type specific fields are null
      loadData.fsc = null;
    } else {
      return res.status(400).json({ message: 'Invalid driverPayType specified.' });
    }

    for (const field of allRequiredFields) {
      // Check direct properties of loadData first, then original req.body for linehaul, fsc, fscPerLoadedMile
      const valueToCheck = loadData.hasOwnProperty(field) ? loadData[field] : req.body[field];
      if (valueToCheck === undefined || valueToCheck === null || valueToCheck === '') { // Allow 0 for numeric fields
        // Special handling for numeric fields that can be 0 but not empty string
        if (typeof valueToCheck === 'number' && valueToCheck === 0) continue;
        return res.status(400).json({ message: `Missing or invalid required field: ${field}` });
      }
    }

    // Financials are now received from frontend
    // No backend calculation for calculatedGross or projectedNet needed here
    // loadData.fuelCost = loadData.fuelCost || 0; // Assuming fuelCost is handled differently or not set here

    console.log('Creating load with data:', loadData);
    const load = await Loads.create(loadData);
    res.status(201).json(load);
  } catch (err) {
    console.error('Error creating load:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
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
      driverPayType,
      linehaul,
      fsc,
      fscPerLoadedMile,
      calculatedGross, // from frontend
      projectedNet,  // from frontend
      scaleCost,     // from frontend
      ...restOfBody
    } = req.body;

    const updatedLoadData = { ...restOfBody, driverPayType, calculatedGross, projectedNet, scaleCost };

    updatedLoadData.dateDelivered = updatedLoadData.dateDelivered &&
      updatedLoadData.dateDelivered !== 'Invalid date' &&
      !isNaN(new Date(updatedLoadData.dateDelivered).getTime())
      ? new Date(updatedLoadData.dateDelivered)
      : null;

    if (!updatedLoadData.dateDelivered) {
      const otherActiveLoad = await Loads.findOne({
        where: {
          userId: req.userId,
          dateDelivered: null,
          proNumber: { [Op.ne]: proNumber },
        },
      });
      if (otherActiveLoad) {
        return res.status(409).json({
          message: 'Another load is already active. Cannot set this load as active.'
        });
      }
    }

    // Conditionally assign pay-type specific fields
    if (driverPayType === 'percentage') {
      updatedLoadData.linehaul = linehaul;
      updatedLoadData.fsc = fsc;
      updatedLoadData.fscPerLoadedMile = null;
    } else if (driverPayType === 'mileage') {
      updatedLoadData.fscPerLoadedMile = fscPerLoadedMile;
      updatedLoadData.linehaul = null;
      updatedLoadData.fsc = null;
    } else if (driverPayType !== undefined) { // only error if it was provided and is invalid
      return res.status(400).json({ message: 'Invalid driverPayType specified for update.' });
    }
    // If driverPayType is not in req.body, it won't be updated, retaining its original value.

    // Financials are now received from frontend
    // No backend calculation for calculatedGross or projectedNet needed here

    console.log('Updating load with data:', updatedLoadData);
    await loadToUpdate.update(updatedLoadData);
    res.json(loadToUpdate);
  } catch (err) {
    console.error('Error updating load:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Server error during load update' });
  }
});

// Complete Load
app.put('/api/loads/:proNumber/complete', authenticate, async (req, res) => {
  try {
    const load = await Loads.findOne({
      where: { proNumber: req.params.proNumber, userId: req.userId },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (load.dateDelivered) {
      return res.status(400).json({ message: 'Load already completed' });
    }
    load.dateDelivered = new Date();
    await load.save();
    console.log('Completed load:', load.proNumber);
    res.json(load);
  } catch (err) {
    console.error('Error completing load:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fuel Stop Routes
// ------------------------------------------------------------------------------------

// Create Fuel Stop
app.post('/api/fuelstops', authenticate, async (req, res) => {
  try {
    const {
      proNumber,
      dateOfStop,
      vendorName,
      location,
      gallonsDieselPurchased,
      pumpPriceDiesel,
      gallonsDefPurchased,
      pumpPriceDef,
    } = req.body;

    // Required fields from the frontend payload
    const requiredFrontendFields = ['proNumber', 'dateOfStop', 'vendorName', 'location', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
    for (const field of requiredFrontendFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        return res.status(400).json({ message: `Missing required field from payload: ${field}` });
      }
    }
    const load = await Loads.findOne({ where: { proNumber, userId: req.userId } });
    if (!load) {
      return res.status(404).json({ message: 'Associated load not found or access denied.' });
    }

    const gdp = parseFloat(gallonsDieselPurchased);
    const ppd = parseFloat(pumpPriceDiesel);
    // Assuming 5 cents discount per gallon for diesel
    const costDieselPurchased = (ppd - 0.05) * gdp;

    let totalDefCost = 0; // Initialize totalDefCost
    if (gallonsDefPurchased && pumpPriceDef) {
      const gdefp = parseFloat(gallonsDefPurchased);
      const ppdef = parseFloat(pumpPriceDef);
      if (gdefp > 0 && ppdef > 0) {
        totalDefCost = ppdef * gdefp; // Correctly assign to totalDefCost
      }
    }
    const totalFuelStopCost = costDieselPurchased + totalDefCost;

    // Map frontend payload and calculated values to the FuelStops model fields
    const fuelStopData = {
      proNumber,
      userId: req.userId,
      dateOfStop: dateOfStop, // Ensure this is a valid date format for Sequelize
      vendor: vendorName, // Use vendorName for the 'vendor' model field
      location: location,
      gallonsDeiselPurchased: gdp,         // Model field name
      DieselpricePerGallon: ppd,         // Model field name
      totalDieselCost: costDieselPurchased.toFixed(2), // Model field name
      gallonsDefPurchased: gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null, // Matches model
      DefpricePerGallon: pumpPriceDef ? parseFloat(pumpPriceDef) : null,             // Model field name
      totalDefCost: totalDefCost.toFixed(2), // Matches model
      totalFuelStop: totalFuelStopCost.toFixed(2), // Model field name
    };

    // Validate that all model-required fields are present before creation
    const modelRequiredFields = ['proNumber', 'userId', 'dateOfStop', 'vendor', 'location', 'gallonsDeiselPurchased', 'DieselpricePerGallon', 'gallonsDefPurchased', 'DefpricePerGallon'];
    for (const field of modelRequiredFields) {
      if (fuelStopData[field] === undefined || fuelStopData[field] === null) {
        // For numeric fields that can be 0, check if they are specifically undefined
        if (typeof fuelStopData[field] === 'number' && fuelStopData[field] === 0) {
          continue;
        }
        // For DEF fields that can be null if not provided
        if ((field === 'gallonsDefPurchased' || field === 'DefpricePerGallon') && fuelStopData[field] === null) {
          continue;
        }
        console.error(`Validation Error: Missing or null required model field: ${field}, Value: ${fuelStopData[field]}`);
        return res.status(400).json({ message: `Internal data mapping error: Missing required model field: ${field}. Please check API logic.` });
      }
    }


    console.log('Attempting to create FuelStop with data:', fuelStopData);
    const fuelStop = await FuelStops.create(fuelStopData);
    res.status(201).json(fuelStop);
  } catch (err) {
    console.error('Error creating fuel stop:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
    }
    res.status(500).json({ message: 'Server error while creating fuel stop' });
  }
});

// Get Fuel Stops (for the authenticated user, optionally filtered by proNumber)
app.get('/api/fuelstops', authenticate, async (req, res) => {
  try {
    const { proNumber } = req.query; // Optional query parameter to filter by load
    const whereClause = { userId: req.userId };
    if (proNumber) {
      whereClause.proNumber = proNumber;
    }
    const fuelStops = await FuelStops.findAll({
      where: whereClause,
      include: [{ model: Loads, as: 'load', attributes: ['proNumber', 'originCity', 'destinationCity'] }], // Include some Load info
      order: [['dateOfStop', 'DESC']], // Show newest first
    });
    res.json(fuelStops);
  } catch (err) {
    console.error('Error fetching fuel stops:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single Fuel Stop by ID (Optional - more common to fetch by user & load)
// If you need this, ensure your fuel stops have a unique ID accessible.
// app.get('/api/fuelstops/:id', authenticate, async (req, res) => {
//   try {
//     const fuelStop = await FuelStop.findOne({
//       where: { id: req.params.id, userId: req.userId },
//       include: [{ model: Loads, as: 'load' }]
//     });
//     if (!fuelStop) return res.status(404).json({ message: 'Fuel stop not found' });
//     res.json(fuelStop);
//   } catch (err) {
//     console.error('Error fetching fuel stop:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });


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
      vendorName,
      location,
      gallonsDieselPurchased,
      pumpPriceDiesel,
      gallonsDefPurchased,
      pumpPriceDef,
    } = req.body;

    const requiredFields = ['dateOfStop', 'vendorName', 'location', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          return res.status(400).json({ message: `Missing required field for update: ${field}` });
        }
      }
    }

    const gdp = parseFloat(gallonsDieselPurchased || fuelStop.gallonsDieselPurchased);
    const ppd = parseFloat(pumpPriceDiesel || fuelStop.pumpPriceDiesel);
    const costDieselPurchased = (ppd - 0.05) * gdp;

    let costDef = 0;
    const currentGallonsDef = gallonsDefPurchased !== undefined ? gallonsDefPurchased : fuelStop.gallonsDefPurchased;
    const currentPumpPriceDef = pumpPriceDef !== undefined ? pumpPriceDef : fuelStop.pumpPriceDef;

    if (currentGallonsDef && currentPumpPriceDef) {
      const gdefp = parseFloat(currentGallonsDef);
      const ppdef = parseFloat(currentPumpPriceDef);
      if (gdefp > 0 && ppdef > 0) {
        costDef = ppdef * gdefp;
      }
    }
    const totalFuelStopCost = costDieselPurchased + costDef;

    const updateData = { ...req.body };
    updateData.costDieselPurchased = costDieselPurchased.toFixed(2);
    if (gallonsDefPurchased !== undefined) {
      updateData.gallonsDefPurchased = gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null;
    }
    if (pumpPriceDef !== undefined) {
      updateData.pumpPriceDef = pumpPriceDef ? parseFloat(pumpPriceDef) : null;
    }
    updateData.costDef = costDef.toFixed(2);
    updateData.totalFuelStopCost = totalFuelStopCost.toFixed(2);

    await fuelStop.update(updateData);
    res.json(fuelStop);
  } catch (err) {
    console.error('Error updating fuel stop:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
    }
    res.status(500).json({ message: 'Server error' });
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
    res.status(200).json({ message: 'Fuel stop deleted successfully' }); // Changed to 200 for delete with message
  } catch (err) {
    console.error('Error deleting fuel stop:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Settings Routes
// ------------------------------------------------------------------------------------

// GET current user's settings
app.get('/api/users/settings', authenticate, async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ where: { userId: req.userId } });
    if (!settings) {
      // If no settings exist, create default settings for the user
      console.log(`No settings found for userId: ${req.userId}. Creating default settings.`);
      settings = await UserSettings.create({ userId: req.userId });
      // The model has default values for driverPayType and percentageRate
    }
    res.json(settings);
  } catch (err) {
    console.error('Error fetching user settings:', err);
    res.status(500).json({ message: 'Error fetching user settings' });
  }
});

// PUT (update/create) user's settings
app.put('/api/users/settings', authenticate, async (req, res) => {
  try {
    // Fields expected from frontend.
    // percentageRate and tax/fee fields are expected as decimals (e.g., 0.68 for 68%, 0.05 for 5 cents)
    const {
      driverPayType,
      percentageRate,
      fuelRoadUseTax,
      maintenanceReserve,
      bondDeposit,
      mrpFee
    } = req.body;

    const updateData = {};

    if (driverPayType) {
      if (!['percentage', 'mileage'].includes(driverPayType)) {
        return res.status(400).json({ message: 'Invalid driverPayType' });
      }
      updateData.driverPayType = driverPayType;
      // If switching to mileage, explicitly nullify percentageRate
      if (driverPayType === 'mileage') {
        updateData.percentageRate = null;
      }
    }

    // Handle percentageRate (expected as 0.0-1.0 from frontend)
    if (percentageRate !== undefined) {
      const rate = parseFloat(percentageRate);
      if (isNaN(rate) || rate < 0 || rate > 1) { // Validating as 0.0-1.0
        return res.status(400).json({ message: 'Invalid percentageRate. Must be a decimal between 0 and 1.' });
      }
      updateData.percentageRate = rate;
    }

    // Generic handler for other float settings (e.g., fuelRoadUseTax, maintenanceReserve)
    // These are also expected as decimals from the frontend.
    const otherFloatSettings = {
      fuelRoadUseTax,
      maintenanceReserve,
      bondDeposit,
      mrpFee
    };

    for (const key in otherFloatSettings) {
      const value = otherFloatSettings[key];
      if (value !== undefined) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return res.status(400).json({ message: `Invalid value for ${key}. Must be a number.` });
        }
        // Add specific range validation if necessary, e.g., if (numValue < 0 || numValue > 1)
        updateData[key] = numValue;
      }
    }

    const [settings, created] = await UserSettings.upsert(
      { userId: req.userId, ...updateData },
      { returning: true } // Ensures the updated/created record is returned
    );
    const resultSettings = Array.isArray(settings) ? settings[0] : settings;

    res.json(resultSettings);
  } catch (err) {
    console.error('Error updating user settings:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Error updating user settings' });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));