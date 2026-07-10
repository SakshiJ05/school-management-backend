import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    school_id: { type: DataTypes.INTEGER },
    action: { type: DataTypes.STRING(200), allowNull: false },
    module: { type: DataTypes.STRING(100), allowNull: false },
    details: { type: DataTypes.JSON },
    ip_address: { type: DataTypes.STRING(50) },
  },
  { tableName: 'audit_logs', updatedAt: false },
);

export default AuditLog;
