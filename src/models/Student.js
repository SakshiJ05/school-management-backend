import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Student = sequelize.define(
  'Student',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER },
    name: { type: DataTypes.STRING(200), allowNull: false },
    roll_number: { type: DataTypes.STRING(50) },
    class_id: { type: DataTypes.INTEGER },
    section_id: { type: DataTypes.INTEGER },
    dob: { type: DataTypes.DATEONLY },
    gender: { type: DataTypes.ENUM('male', 'female', 'other') },
    photo_url: { type: DataTypes.STRING(500) },
    admission_date: { type: DataTypes.DATEONLY },
    parent_name: { type: DataTypes.STRING(200) },
    parent_phone: { type: DataTypes.STRING(20) },
    parent_email: { type: DataTypes.STRING(150) },
    address: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'transferred'),
      defaultValue: 'active',
    },
  },
  { tableName: 'students', updatedAt: false },
);

export default Student;
