import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const InventoryItem = sequelize.define(
  'InventoryItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.STRING(100) },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    condition: { type: DataTypes.STRING(20), defaultValue: 'good' },
    location: { type: DataTypes.STRING(200) },
  },
  { tableName: 'inventory_items', updatedAt: false },
);

export default InventoryItem;
