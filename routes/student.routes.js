import express from 'express';
import { StudentController } from '../controllers/student.controller.js';
import { permit } from '../middleware/rbac.middleware.js';

const router = express.Router();

router.get('/', permit('students', 'read'), StudentController.getAll);
router.post('/promote', permit('students', 'update'), StudentController.promote);
router.get('/:id/attendance', permit('students', 'read'), StudentController.getAttendance);
router.get('/:id/fees', permit('students', 'read'), StudentController.getFees);
router.get('/:id', permit('students', 'read'), StudentController.getById);
router.post('/', permit('students', 'create'), StudentController.create);
// Angular client sends PATCH for edits; PUT kept for API compatibility.
router.put('/:id', permit('students', 'update'), StudentController.update);
router.patch('/:id', permit('students', 'update'), StudentController.update);
router.delete('/:id', permit('students', 'delete'), StudentController.delete);

export default router;
