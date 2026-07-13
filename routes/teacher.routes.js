import express from 'express';
import bcrypt from 'bcryptjs';
import { TeacherController } from '../controllers/teacher.controller.js';
import { permit } from '../middleware/rbac.middleware.js';
import { sendOtpEmail } from '../services/mail.service.js';

const router = express.Router();

export const teacherOtpStore = new Map();

router.post('/request-otp', permit('teachers', 'create'), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    teacherOtpStore.set(email, {
      otpHash: bcrypt.hashSync(otp, 10),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await sendOtpEmail(email, otp, 'teacher account verification');
    console.log(`[DEV] Teacher Create OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent to teacher email',
      data: { sent: true }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Could not send OTP' });
  }
});

// Middleware to verify teacher OTP
function verifyTeacherOtp(req, res, next) {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }
  const stored = teacherOtpStore.get(String(email).trim().toLowerCase());
  if (!stored) {
    return res.status(400).json({ message: 'No OTP requested for this email' });
  }
  if (Date.now() > stored.expiresAt) {
    teacherOtpStore.delete(String(email).trim().toLowerCase());
    return res.status(400).json({ message: 'OTP has expired' });
  }
  if (!bcrypt.compareSync(String(otp), stored.otpHash)) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }
  teacherOtpStore.delete(String(email).trim().toLowerCase());
  next();
}

router.get('/', permit('teachers', 'read'), TeacherController.getAll);
router.get('/:id', permit('teachers', 'read'), TeacherController.getById);
router.post('/', permit('teachers', 'create'), verifyTeacherOtp, TeacherController.create);
// Angular client sends PATCH for edits; PUT kept for API compatibility.
router.put('/:id', permit('teachers', 'update'), TeacherController.update);
router.patch('/:id', permit('teachers', 'update'), TeacherController.update);
router.delete('/:id', permit('teachers', 'delete'), TeacherController.delete);

export default router;
