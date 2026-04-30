import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import connectDB from './config/database';
import { logger } from './utils/logger';
import { startCronJobs } from './jobs/noShowJobs';

// Route imports
import authRoutes from './routes/auth';
import appointmentRoutes from './routes/appointments';
import departmentRoutes from './routes/departments';
import patientRoutes from './routes/patients';
import userRoutes from './routes/users';
import walkInRoutes from './routes/walkIn';
import reportRoutes from './routes/reports';

import settingsRoutes from './routes/settings';
import { initializeSettings } from './controllers/settingsController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Render (and most reverse-proxy hosts) terminate TLS at the load balancer
// and forward the real client IP via X-Forwarded-For. Without this, Express
// reports req.ip as the proxy's IP — meaning every user appears to share
// the same IP and rate limits get hit immediately.
// trust proxy = 1 means "trust the FIRST hop" (Render's edge proxy).
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Two-tier strategy:
//
//   1. Global limiter — generous (1000/15min) so a real interactive session
//      with dashboards, polling, and navigation never gets 429'd. The old
//      limit of 100/15min was being hit just by browsing the dashboard for
//      a few minutes.
//
//   2. Auth limiter — strict (10/15min) on /api/auth/login and
//      /api/auth/register only, because those are the actually attackable
//      endpoints (credential stuffing, account-creation abuse).
//
// Both return JSON so the frontend can display the error nicely instead of
// receiving plain text and falling back to "unknown error".
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,   // RateLimit-* headers (the modern spec)
  legacyHeaders: false,    // disable deprecated X-RateLimit-* headers
  message: { message: 'Too many requests. Please slow down and try again in a minute.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count successful logins toward the limit — only failed attempts.
  // This means brute-forcers hit the wall fast but a normal user who logs
  // in and out a few times during testing isn't punished.
  skipSuccessfulRequests: true,
  message: { message: 'Too many authentication attempts. Please wait 15 minutes.' },
});

// Apply the strict limiter ONLY to login and register (and any other auth
// write endpoints), not to /api/auth/me etc. which a real session polls.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Apply the generous global limiter to everything else under /api/.
app.use('/api/', globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/users', userRoutes);
app.use('/api/walk-in', walkInRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
const startServer = async () => {
  await connectDB();
  await initializeSettings();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    startCronJobs();
  });
};

startServer();

export default app;