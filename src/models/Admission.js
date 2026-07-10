import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Admission = sequelize.define(
  'Admission',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    enquiry_id: { type: DataTypes.INTEGER },
    student_name: { type: DataTypes.STRING(200), allowNull: false },
    parent_phone: { type: DataTypes.STRING(20) },
    class_applied: { type: DataTypes.STRING(100) },
    documents_submitted: { type: DataTypes.BOOLEAN, defaultValue: false },
    fee_paid: { type: DataTypes.BOOLEAN, defaultValue: false },
    status: { type: DataTypes.STRING(50), defaultValue: 'pending' },
    applied_on: { type: DataTypes.DATEONLY },
  },
  { tableName: 'admissions', updatedAt: false },
);

export default Admission;
