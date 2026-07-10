import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Class = sequelize.define(
  'Class',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
  },
  { tableName: 'classes', updatedAt: false },
);

export default Class;
