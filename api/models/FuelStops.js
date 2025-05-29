const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FuelStops = sequelize.define('FuelStops', {
    proNumber: { type: DataTypes.STRING, allowNull: false, references: { model: 'Loads', key: 'proNumber' } },
    userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
    dateOfStop: { type: DataTypes.DATE, allowNull: false },
    vendor: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false },
    gallonsDeiselPurchased: { type: DataTypes.FLOAT, allowNull: false },
    DieselpricePerGallon: { type: DataTypes.FLOAT, allowNull: false },
    totalDieselCost: { type: DataTypes.FLOAT, allowNull: true },
    gallonsDefPurchased: { type: DataTypes.FLOAT, allowNull: false },
    DefpricePerGallon: { type: DataTypes.FLOAT, allowNull: false },
    totalDefCost: { type: DataTypes.FLOAT, allowNull: true },
    totalFuelStop: { type: DataTypes.FLOAT, allowNull: true }

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