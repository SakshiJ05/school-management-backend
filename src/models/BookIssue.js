import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const BookIssue = sequelize.define(
  'BookIssue',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    book_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    issued_on: { type: DataTypes.DATEONLY, allowNull: false },
    due_on: { type: DataTypes.DATEONLY },
    returned: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: 'book_issues', updatedAt: false },
);

export default BookIssue;
