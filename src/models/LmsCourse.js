import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LmsCourse = sequelize.define(
  'LmsCourse',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    subject: { type: DataTypes.STRING(100) },
    class_id: { type: DataTypes.INTEGER },
    description: { type: DataTypes.TEXT },
    lesson_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: 'lms_courses', updatedAt: false },
);

export default LmsCourse;
