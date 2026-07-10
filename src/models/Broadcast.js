import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Broadcast = sequelize.define(
  'Broadcast',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    subject: { type: DataTypes.STRING(300), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    channel: {
      type: DataTypes.ENUM('app', 'sms', 'email'),
      defaultValue: 'app',
    },
    audience: {
      type: DataTypes.ENUM('all', 'teachers', 'parents', 'students'),
      defaultValue: 'all',
    },
    sent_by: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING(20), defaultValue: 'sent' },
  },
  { tableName: 'broadcasts', updatedAt: false },
);

export default Broadcast;
