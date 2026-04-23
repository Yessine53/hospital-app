import { Router } from 'express';
import {
  createAppointment, getAppointments, getAppointment,
  updateAppointment, confirmAppointment, cancelAppointment,
  getAvailableSlots, getDashboardStats,
} from '../controllers/appointmentController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.get('/slots', authenticate, getAvailableSlots);
router.get('/dashboard', authenticate, getDashboardStats);

router.get('/', authenticate, authorize('appointments:read', 'appointments:read_own'), getAppointments);
router.get('/:id', authenticate, authorize('appointments:read', 'appointments:read_own'), getAppointment);

router.post('/',
  authenticate,
  authorize('appointments:write', 'appointments:write_own'),
  auditLog('create', 'appointment'),
  createAppointment
);

router.put('/:id',
  authenticate,
  authorize('appointments:write', 'appointments:write_own', 'appointments:manage'),
  auditLog('update', 'appointment'),
  updateAppointment
);

router.post('/:id/confirm',
  authenticate,
  auditLog('confirm', 'appointment'),
  confirmAppointment
);

router.post('/:id/cancel',
  authenticate,
  authorize('appointments:write', 'appointments:write_own', 'appointments:manage'),
  auditLog('cancel', 'appointment'),
  cancelAppointment
);

export default router;
