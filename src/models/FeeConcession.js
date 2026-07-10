import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FeeConcession = sequelize.define(
  'FeeConcession',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER },
    student_name: { type: DataTypes.STRING(200) },
    type: { type: DataTypes.STRING(100) },
    percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    approved_by: { type: DataTypes.STRING(100) },
    status: { type: DataTypes.STRING(20), defaultValue: 'active' },
  },
  { tableName: 'fee_concessions', updatedAt: false },
);

export default FeeConcession;
