import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Attendance = sequelize.define(
  'Attendance',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('present', 'absent', 'late', 'holiday'),
      allowNull: false,
    },
    marked_by: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: 'attendance',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['student_id', 'date'] }],
  },
);

export default Attendance;
