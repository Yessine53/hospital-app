import { Router } from 'express';
import { addToQueue, getQueue, callNext, updateQueueStatus } from '../controllers/walkInController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, authorize('walkin:write'), addToQueue);
router.get('/:departmentId', authenticate, authorize('walkin:read'), getQueue);
router.post('/:departmentId/call-next', authenticate, authorize('walkin:write'), callNext);
router.put('/:id/status', authenticate, authorize('walkin:write'), updateQueueStatus);

export default router;
