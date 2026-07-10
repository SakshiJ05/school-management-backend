import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TransportRoute = sequelize.define(
  'TransportRoute',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    bus_number: { type: DataTypes.STRING(50) },
    driver_name: { type: DataTypes.STRING(150) },
  },
  { tableName: 'transport_routes', updatedAt: false },
);

export default TransportRoute;
