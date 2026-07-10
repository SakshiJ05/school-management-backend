import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const HostelRoom = sequelize.define(
  'HostelRoom',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    building: { type: DataTypes.STRING(100) },
    room_number: { type: DataTypes.STRING(20) },
    capacity: { type: DataTypes.INTEGER, defaultValue: 4 },
    occupied: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: 'hostel_rooms', updatedAt: false },
);

export default HostelRoom;
