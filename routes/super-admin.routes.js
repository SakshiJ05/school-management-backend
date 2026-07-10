import { Router } from 'express';
import { loginRateLimit } from '../middleware/rateLimit.middleware.js';
import { verifyToken, isSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { login, me } from '../controllers/super-admin/auth.controller.js';
import * as dashCtrl from '../controllers/super-admin/dashboard.controller.js';
import * as schoolsCtrl from '../controllers/super-admin/schools.controller.js';
import * as usersCtrl from '../controllers/super-admin/users.controller.js';
import * as subsCtrl from '../controllers/super-admin/subscriptions.controller.js';
import * as settingsCtrl from '../controllers/super-admin/settings.controller.js';
import * as announceCtrl from '../controllers/super-admin/announcements.controller.js';
import * as auditCtrl from '../controllers/super-admin/audit.controller.js';

const router = Router();

// Public auth (rate-limited)
router.post('/auth/login', loginRateLimit, login);
router.get('/auth/me', verifyToken, isSuperAdmin, me);

// Protected super-admin API
router.use(verifyToken, isSuperAdmin);

router.get('/dashboard', dashCtrl.getDashboard);

router.get('/schools', schoolsCtrl.listSchools);
router.get('/schools/:id', schoolsCtrl.getSchool);
router.post('/schools', schoolsCtrl.createSchool);
router.put('/schools/:id', schoolsCtrl.updateSchool);
router.delete('/schools/:id', schoolsCtrl.deleteSchool);
router.patch('/schools/:id/toggle-status', schoolsCtrl.toggleSchoolStatus);

router.get('/users', usersCtrl.listUsers);
router.post('/users', usersCtrl.createUser);
router.patch('/users/:id/toggle-block', usersCtrl.toggleUserBlock);
router.post('/users/:id/reset-password', usersCtrl.resetUserPassword);
router.patch('/users/:id/role', usersCtrl.updateUserRole);

router.get('/plans', subsCtrl.listPlans);
router.post('/plans', subsCtrl.createPlan);
router.put('/plans/:id', subsCtrl.updatePlan);
router.delete('/plans/:id', subsCtrl.deletePlan);
router.get('/subscriptions', subsCtrl.listSubscriptions);
router.post('/subscriptions/assign', subsCtrl.assignPlanToSchool);
router.get('/payments', subsCtrl.listPayments);
router.post('/payments', subsCtrl.recordPayment);

router.get('/settings', settingsCtrl.getSettings);
router.put('/settings', settingsCtrl.updateSettings);
router.patch('/settings/maintenance', settingsCtrl.toggleMaintenance);

router.get('/announcements', announceCtrl.listAnnouncements);
router.post('/announcements', announceCtrl.sendAnnouncement);

router.get('/audit-logs', auditCtrl.listAuditLogs);

export default router;
