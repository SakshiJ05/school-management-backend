import { Router } from 'express';
import * as saCtrl from '../controllers/superAdmin.controller.js';

const router = Router();

router.get('/analytics', saCtrl.globalAnalytics);
router.get('/schools', saCtrl.listSchools);
router.post('/schools/request-admin-otp', saCtrl.requestSchoolAdminOtp);
router.post('/schools', saCtrl.provisionSchool);
router.get('/schools/:id', saCtrl.getSchool);
router.patch('/schools/:id', saCtrl.updateSchool);
router.post('/schools/:id/invite-admin', saCtrl.inviteSchoolAdmin);

export default router;
