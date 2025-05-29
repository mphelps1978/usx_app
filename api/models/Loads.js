// models/Loads.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Loads = sequelize.define('Loads', {
    proNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    dateDispatched: { type: DataTypes.DATEONLY, allowNull: false },
    dateDelivered: { type: DataTypes.DATEONLY, allowNull: true },
    trailerNumber: { type: DataTypes.STRING, allowNull: true },
    originCity: { type: DataTypes.STRING, allowNull: false },
    originState: { type: DataTypes.STRING, allowNull: false },
    destinationCity: { type: DataTypes.STRING, allowNull: false },
    destinationState: { type: DataTypes.STRING, allowNull: false },
    deadheadMiles: { type: DataTypes.FLOAT, allowNull: false },
    loadedMiles: { type: DataTypes.FLOAT, allowNull: false },
    totalMiles: { type: DataTypes.FLOAT, allowNull: true },
    weight: { type: DataTypes.FLOAT, allowNull: false },
    linehaul: { type: DataTypes.FLOAT, allowNull: true },
    fsc: { type: DataTypes.FLOAT, allowNull: true },
    fscPerLoadedMile: { type: DataTypes.FLOAT, allowNull: true },
    driverPayType: { type: DataTypes.ENUM('percentage', 'mileage'), allowNull: true },
    calculatedGross: { type: DataTypes.FLOAT, allowNull: true },
    fuelCost: { type: DataTypes.FLOAT, allowNull: false },
    scaleCost: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
    fuelRoadUseTax: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    maintenanceReserve: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    bondDeposit: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    mrpFee: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    totalDeductions: { type: DataTypes.FLOAT, allowNull: true },
    projectedNet: { type: DataTypes.FLOAT, allowNull: true },

  }, {
    timestamps: true,
  });

  Loads.associate = (models) => {
    Loads.hasMany(models.FuelStops, {
      foreignKey: 'proNumber',
      sourceKey: 'proNumber',
      as: 'fuelStops'
    });
    Loads.belongsTo(models.Users, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Loads;
};