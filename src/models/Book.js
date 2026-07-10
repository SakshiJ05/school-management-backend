import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Book = sequelize.define(
  'Book',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    isbn: { type: DataTypes.STRING(50) },
    copies: { type: DataTypes.INTEGER, defaultValue: 1 },
    available: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  { tableName: 'books', updatedAt: false },
);

export default Book;
