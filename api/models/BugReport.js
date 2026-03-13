const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BugReport = sequelize.define('BugReport', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Allow anonymous reports if token is not present, or make false if user must be logged in
      references: {
        model: 'Users', // Name of the Users table
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    stepsToReproduce: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT, // User agents can be long
      allowNull: true,
    },
    appVersion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'new', // e.g., 'new', 'seen', 'investigating', 'resolved', 'wontfix'
    },
    // Sequelize automatically adds createdAt and updatedAt
  }, {
    timestamps: true, // Enable createdAt and updatedAt
  });

  BugReport.associate = (models) => {
    BugReport.belongsTo(models.Users, {
      foreignKey: 'userId',
      as: 'reporter', // Optional alias
    });
  };

  return BugReport;
};
