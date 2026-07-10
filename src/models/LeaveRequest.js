import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LeaveRequest = sequelize.define(
  'LeaveRequest',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.STRING(50) },
    employee_name: { type: DataTypes.STRING(200), allowNull: false },
    employee_type: { type: DataTypes.STRING(20), defaultValue: 'teacher' },
    from_date: { type: DataTypes.DATEONLY },
    to_date: { type: DataTypes.DATEONLY },
    reason: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  },
  { tableName: 'leave_requests', updatedAt: false },
);

export default LeaveRequest;
