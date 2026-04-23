import { Router } from 'express';
import {
  getPatients, getPatient, createPatient, updatePatient, getPatientHistory,
} from '../controllers/patientController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.get('/', authenticate, authorize('patients:read'), getPatients);
router.get('/:id', authenticate, authorize('patients:read', 'patients:read_own'), getPatient);
router.post('/', authenticate, authorize('patients:write'), auditLog('create', 'patient'), createPatient);
router.put('/:id', authenticate, authorize('patients:write'), auditLog('update', 'patient'), updatePatient);
router.get('/:id/history', authenticate, authorize('patients:read', 'patients:read_own'), getPatientHistory);

export default router;
