import dns from 'dns';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { sequelize } from '../src/models/index.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';

if (mongoUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
dns.setDefaultResultOrder('ipv4first');

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 25_000, family: 4 });
  const collections = await mongoose.connection.db.listCollections().toArray();
  const mongoCounts = await Promise.all(
    collections.map(({ name }) => mongoose.connection.db.collection(name).countDocuments()),
  );

  await sequelize.authenticate();
  const [mysqlTables] = await sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
  );
  const mysqlCounts = await Promise.all(
    mysqlTables.map(async ({ TABLE_NAME: tableName }) => {
      const quotedTable = sequelize.getQueryInterface().quoteIdentifier(tableName);
      const [[row]] = await sequelize.query(`SELECT COUNT(*) AS total FROM ${quotedTable}`);
      return Number(row.total);
    }),
  );

  console.log(`MongoDB records: ${mongoCounts.reduce((sum, count) => sum + count, 0)}`);
  console.log(`MySQL records: ${mysqlCounts.reduce((sum, count) => sum + count, 0)}`);
} finally {
  await Promise.allSettled([mongoose.disconnect(), sequelize.close()]);
}
