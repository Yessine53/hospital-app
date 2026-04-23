import { Router } from 'express';
import {
  getDepartments, getDepartment, createDepartment, updateDepartment,
  getSpecialties, createSpecialty, updateSpecialty, getDoctorsByDepartment,
} from '../controllers/departmentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('departments:read'), getDepartments);
router.get('/:id', authenticate, authorize('departments:read'), getDepartment);
router.post('/', authenticate, authorize('departments:write'), createDepartment);
router.put('/:id', authenticate, authorize('departments:write'), updateDepartment);

router.get('/:departmentId/doctors', authenticate, getDoctorsByDepartment);

// Specialties
router.get('/specialties/all', authenticate, getSpecialties);
router.post('/specialties', authenticate, authorize('departments:write'), createSpecialty);
router.put('/specialties/:id', authenticate, authorize('departments:write'), updateSpecialty);

export default router;
