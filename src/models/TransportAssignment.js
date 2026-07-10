import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TransportAssignment = sequelize.define(
  'TransportAssignment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    route_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'transport_assignments', updatedAt: false },
);

export default TransportAssignment;
