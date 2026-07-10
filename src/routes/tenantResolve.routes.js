import { Router } from 'express';
import * as resolveCtrl from '../controllers/tenantResolve.controller.js';

const router = Router();

router.get('/resolve', resolveCtrl.resolveBySubdomain);
router.get('/schools', resolveCtrl.listPublicSchools);

export default router;
