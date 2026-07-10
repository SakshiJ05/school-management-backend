import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM('super_admin', 'school_admin', 'teacher', 'student', 'parent'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'blocked'),
      defaultValue: 'active',
    },
    last_login: { type: DataTypes.DATE },
  },
  { tableName: 'users' },
);

export default User;
