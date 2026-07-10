import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FeePayment = sequelize.define(
  'FeePayment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    fee_structure_id: { type: DataTypes.INTEGER, allowNull: false },
    assignment_id: { type: DataTypes.INTEGER },
    amount_paid: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    payment_date: { type: DataTypes.DATEONLY, allowNull: false },
    payment_mode: {
      type: DataTypes.ENUM('cash', 'online', 'upi', 'card', 'bank', 'cheque', 'dd'),
      allowNull: false,
    },
    receipt_number: { type: DataTypes.STRING(100), unique: true },
    remarks: { type: DataTypes.TEXT },
    collected_by: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'fee_payments', updatedAt: false },
);

export default FeePayment;

