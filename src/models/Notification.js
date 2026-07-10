import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notification = sequelize.define(
  'Notification',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER },
    title: { type: DataTypes.STRING(300), allowNull: false },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { tableName: 'notifications', updatedAt: false },
);

export default Notification;
