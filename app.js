import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import resourceRoutes from './routes/resources.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import superAdminRoutes from './routes/super-admin.routes.js';
import billingRoutes from './routes/billing.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import { resolveTenant } from './middleware/tenant.middleware.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { enforceSubscription } from './middleware/subscription.middleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureDb } from './utils/db.js';

ensureDb();

const app = express();

// Behind Fly's proxy req.ip is the proxy without this, collapsing every client
// into a single rate-limit bucket.
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
// Capture the raw body so the Razorpay webhook can verify its HMAC signature.
app.use(express.json({ limit: '10mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(resolveTenant);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
    mongoState: mongoose.connection.readyState,
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
/** Proxy strips /api — same handler for dev tools hitting :3000/dashboard/... */
app.use('/dashboard', dashboardRoutes);
// Specific prefixes MUST be mounted before the catch-all '/api' router below,
// otherwise resourceRoutes' router-level requireAuth intercepts them.
app.use('/api/teachers', requireAuth, enforceSubscription, teacherRoutes);
app.use('/api/students', requireAuth, enforceSubscription, studentRoutes);
app.use('/api/super-admin', superAdminRoutes);
// Billing is NOT behind enforceSubscription — an expired school must be able to pay.
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
// Catch-all resource router (has its own router-level requireAuth) — mount LAST.
app.use('/api', resourceRoutes);

app.use(errorHandler);

export default app;
