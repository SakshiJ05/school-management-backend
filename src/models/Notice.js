import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notice = sequelize.define(
  'Notice',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    target: {
      type: DataTypes.ENUM('all', 'teachers', 'students', 'parents'),
      defaultValue: 'all',
    },
    is_pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
    posted_by: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'notices', updatedAt: false },
);

export default Notice;
