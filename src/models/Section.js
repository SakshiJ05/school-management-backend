import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Section = sequelize.define(
  'Section',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(10), allowNull: false },
    class_teacher_id: { type: DataTypes.INTEGER },
  },
  { tableName: 'sections', updatedAt: false },
);

export default Section;
