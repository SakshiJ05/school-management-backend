import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ExamResult = sequelize.define(
  'ExamResult',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    exam_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    marks_obtained: { type: DataTypes.DECIMAL(5, 2) },
    grade: { type: DataTypes.STRING(5) },
    result: {
      type: DataTypes.ENUM('pass', 'fail', 'absent'),
      allowNull: false,
    },
  },
  { tableName: 'exam_results', timestamps: false },
);

export default ExamResult;
