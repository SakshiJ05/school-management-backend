import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const PayrollRecord = sequelize.define(
  'PayrollRecord',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.STRING(50) },
    employee_name: { type: DataTypes.STRING(200), allowNull: false },
    month: { type: DataTypes.STRING(7) },
    basic_salary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    allowances: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    deductions: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    net_pay: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    status: { type: DataTypes.STRING(20), defaultValue: 'draft' },
  },
  { tableName: 'payroll_records', updatedAt: false },
);

export default PayrollRecord;
