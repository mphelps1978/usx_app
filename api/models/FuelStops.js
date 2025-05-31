const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FuelStops = sequelize.define('FuelStops', {
    proNumber: { type: DataTypes.STRING, allowNull: false, references: { model: 'Loads', key: 'proNumber' } },
    userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
    dateOfStop: { type: DataTypes.DATE, allowNull: false },
    vendor: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false }, // Standard camelCase for consistency
    gallonsDieselPurchased: { type: DataTypes.FLOAT, allowNull: true }, // Corrected typo and casing
    dieselPricePerGallon: { type: DataTypes.FLOAT, allowNull: true }, // Corrected casing
    totalDieselCost: { type: DataTypes.FLOAT, allowNull: true },
    gallonsDefPurchased: { type: DataTypes.FLOAT, allowNull: true }, // Standard camelCase
    defPricePerGallon: { type: DataTypes.FLOAT, allowNull: true }, // Corrected casing
    totalDefCost: { type: DataTypes.FLOAT, allowNull: true },
    totalFuelStop: { type: DataTypes.FLOAT, allowNull: true },
    fuelCardUsed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    discountEligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

  }, {
    timestamps: true,
  });

  FuelStops.associate = (models) => {
    FuelStops.belongsTo(models.Loads, {
      foreignKey: 'proNumber',
      targetKey: 'proNumber',
      as: 'load'
    });
    FuelStops.belongsTo(models.Users, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return FuelStops;
};