import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';
import { runSeedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';

await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
await runSeedIfEmpty();
console.log('Force seed done.');
await mongoose.disconnect();
