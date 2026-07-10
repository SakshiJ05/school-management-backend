import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let io = null;
let Server = null;

try {
  Server = require('socket.io').Server;
} catch {
  console.warn('[realtime] socket.io not installed — live updates disabled. Run: cd backend && npm install');
}

export function initRealtime(httpServer) {
  if (!Server) return null;
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    socket.on('join-tenant', (tenantId) => {
      if (tenantId) socket.join(`tenant:${tenantId}`);
    });
    socket.on('join-user', (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  return io;
}

export function emitTenant(tenantId, event, payload) {
  if (!io || !tenantId) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
}

export function emitUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function getIo() {
  return io;
}
