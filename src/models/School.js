import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const School = sequelize.define(
  'School',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    subdomain: { type: DataTypes.STRING(63), allowNull: true, unique: true },
    city: { type: DataTypes.STRING(100) },
    state: { type: DataTypes.STRING(100) },
    address: { type: DataTypes.TEXT },
    email: { type: DataTypes.STRING(150) },
    phone: { type: DataTypes.STRING(20) },
    logo_url: { type: DataTypes.STRING(500) },
    plan: {
      type: DataTypes.ENUM('trial', 'standard', 'pro', 'enterprise'),
      defaultValue: 'trial',
    },
    plan_expiry: { type: DataTypes.DATEONLY },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
    },
  },
  { tableName: 'schools' },
);

export default School;
