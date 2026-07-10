import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FeeStructure = sequelize.define(
  'FeeStructure',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    category_id: { type: DataTypes.INTEGER },
    type: { type: DataTypes.STRING(100), allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    frequency: {
      type: DataTypes.ENUM('monthly', 'quarterly', 'yearly', 'one-time'),
      defaultValue: 'monthly',
    },
    academic_year: { type: DataTypes.STRING(20) },
    due_date: { type: DataTypes.DATEONLY },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  },
  { tableName: 'fee_structures', updatedAt: false },
);

export default FeeStructure;

