import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Exam = sequelize.define(
  'Exam',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    subject: { type: DataTypes.STRING(100), allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    exam_date: { type: DataTypes.DATEONLY, allowNull: false },
    max_marks: { type: DataTypes.INTEGER, allowNull: false },
    passing_marks: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'exams', updatedAt: false },
);

export default Exam;
