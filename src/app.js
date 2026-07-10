import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database.js';
import './models/index.js';
import authRoutes from './routes/auth.routes.js';
import tenantResolveRoutes from './routes/tenantResolve.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import { requireAuth, requireRole } from './middleware/auth.middleware.js';
import { resolveTenant, requireTenant } from './middleware/tenant.middleware.js';
import { enforceSubscription } from './middleware/subscription.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:4200', 'http://localhost:5173'];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { service: 'scholify-mysql', ok: true }, message: 'OK' });
});

// Auth (no tenant)
app.use('/api/auth', authRoutes);

// Public tenant resolution (subdomain â†’ school)
app.use('/api/tenant', tenantResolveRoutes);

// Super-admin platform (no tenant required)
app.use(
  '/api/super-admin',
  requireAuth,
  requireRole('super_admin'),
  superAdminRoutes,
);

// School portal â€” tenant-scoped CRUD for all modules
app.use('/api', requireAuth, resolveTenant, requireTenant, enforceSubscription, tenantRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

export async function startServer() {
  await connectDatabase();
  const port = Number(process.env.MYSQL_API_PORT) || 5001;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`PathshalaPro MySQL API â†’ http://localhost:${port}`);
      console.log('  Tenant resolve: GET /api/tenant/resolve?subdomain=greenwood');
      console.log('  Super-admin:    POST /api/super-admin/schools');
      console.log('  School CRUD:    GET /api/students (X-School-Id or subdomain)');
      resolve(server);
    });
  });
}

export default app;

