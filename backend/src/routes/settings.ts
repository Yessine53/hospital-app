import { Router } from 'express';
import {
  getSettings, updateSetting, updateSettings,
  getSettingByKey, getAuditLogs,
} from '../controllers/settingsController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

// Settings
router.get('/', authenticate, authorize('settings:write', 'reports:read'), getSettings);
router.get('/key/:key', authenticate, getSettingByKey);
router.put('/update', authenticate, authorize('settings:write'), updateSetting);
router.put('/bulk-update', authenticate, authorize('settings:write'), updateSettings);

// Audit logs
router.get('/audit-logs', authenticate, authorize('audit:read'), getAuditLogs);

export default router;
