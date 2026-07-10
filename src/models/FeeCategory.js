import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FeeCategory = sequelize.define(
  'FeeCategory',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(40), allowNull: false },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
  },
  { tableName: 'fee_categories', updatedAt: false },
);

export default FeeCategory;
