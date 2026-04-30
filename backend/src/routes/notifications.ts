import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getNotifications } from '../controllers/notificationController';

const router = Router();

// All authenticated users get a notification feed — content is filtered
// per-role inside the controller. No specific permission required because
// the feed is always scoped to what the user can already see elsewhere.
router.get('/', authenticate, getNotifications);

export default router;