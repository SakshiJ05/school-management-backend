import { connectDatabase, syncDatabase } from '../config/database.js';
import '../models/index.js';

const alter = process.argv.includes('--alter');
const force = process.argv.includes('--force');

connectDatabase()
  .then(() => syncDatabase({ force, alter }))
  .then(() => {
    console.log('Tables ready.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Sync failed:', err.message);
    process.exit(1);
  });
