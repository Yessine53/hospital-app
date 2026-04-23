import { Response, NextFunction } from 'express';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export const auditLog = (action: string, entity: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.json.bind(res);

    res.json = function (body: any) {
      // Log after successful response
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        AuditLog.create({
          userId: req.user._id,
          action,
          entity,
          entityId: req.params.id || body?.data?._id,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        }).catch((err) => logger.error('Audit log error:', err));
      }
      return originalSend(body);
    };

    next();
  };
};
