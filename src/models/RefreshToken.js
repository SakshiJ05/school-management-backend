import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING(500), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'refresh_tokens', updatedAt: false },
);

export default RefreshToken;
