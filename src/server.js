import { startServer } from './app.js';

startServer().catch((err) => {
  console.error('MySQL API failed to start:', err.message);
  process.exit(1);
});
