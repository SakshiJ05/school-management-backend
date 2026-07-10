import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { sequelize } from '../src/models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.argv.includes('--confirm')) {
  console.error('Refusing to reset databases without --confirm.');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';

if (mongoUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
dns.setDefaultResultOrder('ipv4first');

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 25_000, family: 4 });
  const mongoName = mongoose.connection.db.databaseName;
  await mongoose.connection.dropDatabase();
  console.log(`MongoDB "${mongoName}" cleared.`);

  await sequelize.authenticate();
  const mysqlName = process.env.MYSQL_DATABASE || 'scholify';
  await sequelize.sync({ force: true });
  console.log(`MySQL "${mysqlName}" cleared and empty tables recreated.`);
} finally {
  await Promise.allSettled([
    mongoose.disconnect(),
    sequelize.close(),
  ]);
}

