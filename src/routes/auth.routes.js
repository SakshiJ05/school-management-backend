import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller.js';
import { loginRateLimit } from '../middleware/rateLimiter.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', loginRateLimit, authCtrl.login);
router.post('/register/request-otp', loginRateLimit, authCtrl.requestRegisterOtp);
router.post('/register', loginRateLimit, authCtrl.register);
router.post('/refresh', authCtrl.refresh);
router.post('/logout', authCtrl.logout);
router.post('/forgot-password', loginRateLimit, authCtrl.forgotPassword);
router.post('/reset-password', authCtrl.resetPassword);
router.get('/me', requireAuth, authCtrl.me);

export default router;
