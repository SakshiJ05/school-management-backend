import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Teacher = sequelize.define(
  'Teacher',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    employee_code: { type: DataTypes.STRING(50) },
    phone: { type: DataTypes.STRING(20) },
    subject_expertise: { type: DataTypes.STRING(500) },
    joining_date: { type: DataTypes.DATEONLY },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
  },
  { tableName: 'teachers', updatedAt: false },
);

export default Teacher;
