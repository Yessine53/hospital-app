import { Router } from 'express';
import { getNoShowReport, getReminderReport, getOverviewReport } from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/overview', authenticate, authorize('reports:read'), getOverviewReport);
router.get('/no-shows', authenticate, authorize('reports:read', 'reports:analytics'), getNoShowReport);
router.get('/reminders', authenticate, authorize('reports:read', 'reports:analytics'), getReminderReport);

export default router;
