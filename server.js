import dns from 'dns';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app.js';
import { initRealtime } from './services/realtime.service.js';
import { initSqlMirror } from './utils/sqlMirror.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school_ms';
const MONGODB_URI_FALLBACK = process.env.MONGODB_URI_FALLBACK || '';
const PORT = Number(process.env.PORT) || 5000;

configureDnsForAtlas(MONGODB_URI);

function configureDnsForAtlas(uri) {
  if (process.env.USE_SYSTEM_DNS_ONLY === '1') {
    dns.setDefaultResultOrder('ipv4first');
    return;
  }
  if (uri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    } catch {
      /* ignore */
    }
  }
  dns.setDefaultResultOrder('ipv4first');
}

function redactUri(u) {
  return u.replace(/:([^:@]+)@/, ':****@');
}

async function connectMongo() {
  const attempts = [{ uri: MONGODB_URI, name: 'MONGODB_URI' }];
  if (MONGODB_URI_FALLBACK.trim()) {
    attempts.push({ uri: MONGODB_URI_FALLBACK.trim(), name: 'MONGODB_URI_FALLBACK' });
  }
  let lastErr;
  for (const { uri, name } of attempts) {
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 25_000, family: 4 });
      console.log(`MongoDB connected (${name}) â†’ "${mongoose.connection.db?.databaseName}"`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`Mongo ${name} failed:`, err.message);
    }
  }
  throw lastErr;
}

const httpServer = http.createServer(app);
initRealtime(httpServer);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in backend/.env`);
    console.error('Windows: netstat -ano | findstr :' + PORT + '  then  taskkill /PID <pid> /F');
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`API + WebSocket â†’ http://localhost:${PORT}`);
  console.log('Without MongoDB: JSON fallback via data.json (run seed locally or connect Mongo).');
});

// Bring up the SQL mirror first so both stores are available to the API.
initSqlMirror()
  .catch((err) => console.warn('SQL mirror init error:', err.message))
  .finally(() => {
    connectMongo().catch((err) => {
      console.error('MongoDB not connected â€” using data.json fallback:', err.message);
    });
  });


