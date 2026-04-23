import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser, getDoctors } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.get('/doctors', authenticate, getDoctors);
router.get('/', authenticate, authorize('users:read'), getUsers);
router.post('/', authenticate, authorize('users:write'), auditLog('create', 'user'), createUser);
router.put('/:id', authenticate, authorize('users:write'), auditLog('update', 'user'), updateUser);
router.delete('/:id', authenticate, authorize('users:delete'), auditLog('delete', 'user'), deleteUser);

export default router;
