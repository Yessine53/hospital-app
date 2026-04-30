import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';
import { hasPermission, Permission } from '../config/permissions';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// JWT secret is read once at module load. If it is missing the process must
// refuse to start — a missing secret in production would silently fall back
// to a known string and let anyone forge admin tokens.
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // We log first so the reason is visible in container logs, then exit.
  logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  // process.exit instead of throw so the failure is unambiguous in PM2/Docker logs.
  process.exit(1);
}
// After the guard above, JWT_SECRET is definitely a string. The cast satisfies
// TypeScript's narrowing, which doesn't follow process.exit branches.
const SECRET: string = JWT_SECRET as string;

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, SECRET) as { userId: string; role: string };

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (...permissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const userHasPermission = permissions.some((permission) =>
      hasPermission(req.user!.role as UserRole, permission)
    );

    if (!userHasPermission) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};