import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const HostelAllocation = sequelize.define(
  'HostelAllocation',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    room_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER },
    student_name: { type: DataTypes.STRING(200) },
    from_date: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING(20), defaultValue: 'active' },
  },
  { tableName: 'hostel_allocations', updatedAt: false },
);

export default HostelAllocation;
