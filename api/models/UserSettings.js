const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserSettings = sequelize.define('UserSettings', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true, // Ensures one-to-one with User and is the PK
      references: {
        model: 'Users', // Name of the Users table
        key: 'id',
      },
    },
    driverPayType: {
      type: DataTypes.ENUM('percentage', 'mileage'),
      allowNull: false,
      defaultValue: 'percentage',
    },
    percentageRate: {
      type: DataTypes.FLOAT,
      allowNull: true, // Allow null if driverPayType is 'mileage'
      defaultValue: 0.68, // Default percentage (e.g., 68%)
      validate: {
        min: 0,   // Rate should be 0% or more
        max: 1,   // Rate should be 100% or less (stored as 0.0 to 1.0)
      },
    },
    // Placeholder for mileage-based settings - to be expanded
    // e.g., mileageRateTier1: DataTypes.FLOAT, 
    //       mileageBracket1EndMiles: DataTypes.INTEGER,
  }, {
    timestamps: true, // Adds createdAt and updatedAt
  });

  UserSettings.associate = (models) => {
    UserSettings.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE', // If a User is deleted, their settings are also deleted
    });
  };

  return UserSettings;
}; 