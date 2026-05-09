const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OfficeExpense = sequelize.define('OfficeExpense', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    vendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Vendors', key: 'id' },
    },
    quantity: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    individualPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    extendedPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    tax: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    receiptFileKey: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['vendorId'] },
      { fields: ['category'] },
    ],
  });

  return OfficeExpense;
};
