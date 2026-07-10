import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Enquiry = sequelize.define(
  'Enquiry',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    student_name: { type: DataTypes.STRING(200), allowNull: false },
    parent_name: { type: DataTypes.STRING(200) },
    phone: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(200) },
    class_interested: { type: DataTypes.STRING(100) },
    source: { type: DataTypes.STRING(50), defaultValue: 'walk-in' },
    status: { type: DataTypes.STRING(50), defaultValue: 'new' },
    notes: { type: DataTypes.TEXT },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'enquiries', updatedAt: false, createdAt: 'created_at' },
);

export default Enquiry;
