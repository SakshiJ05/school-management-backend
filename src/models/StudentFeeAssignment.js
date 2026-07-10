import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StudentFeeAssignment = sequelize.define(
  'StudentFeeAssignment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    fee_structure_id: { type: DataTypes.INTEGER, allowNull: false },
    discount_type: { type: DataTypes.ENUM('none', 'percent', 'flat'), defaultValue: 'none' },
    discount_value: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    assigned_on: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'closed'), defaultValue: 'active' },
    remarks: { type: DataTypes.TEXT },
  },
  { tableName: 'student_fee_assignments', updatedAt: false },
);

export default StudentFeeAssignment;
