import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Homework = sequelize.define(
  'Homework',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT },
    subject: { type: DataTypes.STRING(100) },
    due_date: { type: DataTypes.DATEONLY },
    created_by: { type: DataTypes.INTEGER },
  },
  { tableName: 'homework', updatedAt: false },
);

export default Homework;
