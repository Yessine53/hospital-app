import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Appointment, Patient, WalkInQueue } from '../models';
import { logger } from '../utils/logger';
import { UserRole } from '../models/User';

// ---------------------------------------------------------------------------
// Notification system
// ---------------------------------------------------------------------------
// Notifications are computed LIVE from the existing data on each request —
// no separate collection. This means:
//   - No migration risk
//   - Notifications can never go stale relative to operational state
//   - Read/unread is implemented client-side via localStorage (a dismissed
//     notification just stops appearing for that user/browser)
//
// The shape of each notification is intentionally small and stable so the UI
// can render them with a simple <map>:
//
//   {
//     id:       deterministic string (so dismissing one keeps it dismissed)
//     type:     'info' | 'warning' | 'urgent'  → drives icon/colour
//     title:    one line
//     message:  one line of context
//     link:     optional in-app path the bell item links to
//     timestamp ISO date — when the underlying event happened/relates to
//   }
// ---------------------------------------------------------------------------

type NotifType = 'info' | 'warning' | 'urgent';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  link?: string;
  timestamp: string;
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const addDays    = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const role = user.role as UserRole;
    const notifications: Notification[] = [];
    const now = new Date();
    const tomorrow = addDays(now, 1);

    // ---------------------------------------------------------------------
    // PATIENT — personal upcoming appointments + confirmations
    // ---------------------------------------------------------------------
    if (role === UserRole.PATIENT) {
      const patient = await Patient.findOne({ userId: user._id });
      if (patient) {
        // Upcoming appointments in the next 7 days
        const upcoming = await Appointment.find({
          patientId: patient._id,
          date: { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) },
          status: { $in: ['scheduled', 'pending_confirmation', 'confirmed'] },
        })
          .populate('doctorId', 'firstName lastName')
          .populate('departmentId', 'name')
          .sort({ date: 1 })
          .limit(5);

        for (const appt of upcoming) {
          const apptDate = new Date(appt.date);
          const isToday = startOfDay(apptDate).getTime() === startOfDay(now).getTime();
          const isTomorrow = startOfDay(apptDate).getTime() === startOfDay(tomorrow).getTime();
          const doctor: any = appt.doctorId;
          const doctorName = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'your doctor';

          // Pending confirmation = high-risk appointment that needs the
          // patient's explicit confirmation. This is the most important
          // notification a patient can receive.
          if (appt.status === 'pending_confirmation') {
            notifications.push({
              id: `confirm-${appt._id}`,
              type: 'urgent',
              title: 'Please confirm your appointment',
              message: `Appointment ${isToday ? 'today' : isTomorrow ? 'tomorrow' : `on ${apptDate.toLocaleDateString()}`} at ${appt.startTime} with ${doctorName} — please confirm or reschedule`,
              link: '/my-appointments',
              timestamp: apptDate.toISOString(),
            });
          } else if (isToday || isTomorrow) {
            notifications.push({
              id: `upcoming-${appt._id}`,
              type: isToday ? 'warning' : 'info',
              title: isToday ? 'Appointment today' : 'Appointment tomorrow',
              message: `${appt.startTime} with ${doctorName}`,
              link: '/my-appointments',
              timestamp: apptDate.toISOString(),
            });
          }
        }
      }
    }

    // ---------------------------------------------------------------------
    // DOCTOR — today's schedule + high-risk patients
    // ---------------------------------------------------------------------
    if (role === UserRole.DOCTOR) {
      const todays = await Appointment.find({
        doctorId: user._id,
        date: { $gte: startOfDay(now), $lte: endOfDay(now) },
        status: { $in: ['scheduled', 'confirmed', 'in_progress'] },
      })
        .populate('patientId')
        .sort({ startTime: 1 });

      if (todays.length > 0) {
        notifications.push({
          id: `doctor-today-${startOfDay(now).toISOString()}`,
          type: 'info',
          title: `${todays.length} appointment${todays.length === 1 ? '' : 's'} today`,
          message: `Next: ${todays[0].startTime}`,
          link: '/appointments',
          timestamp: now.toISOString(),
        });
      }

      // High-risk appointments today/tomorrow on this doctor's calendar
      const highRisk = await Appointment.find({
        doctorId: user._id,
        date: { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 2)) },
        riskScore: { $gte: 0.6 },
        status: { $in: ['scheduled', 'pending_confirmation'] },
      }).limit(5);

      if (highRisk.length > 0) {
        notifications.push({
          id: `doctor-highrisk-${startOfDay(now).toISOString()}`,
          type: 'warning',
          title: `${highRisk.length} high-risk appointment${highRisk.length === 1 ? '' : 's'}`,
          message: 'Patients flagged with elevated no-show probability in your schedule',
          link: '/no-show-alerts',
          timestamp: now.toISOString(),
        });
      }
    }

    // ---------------------------------------------------------------------
    // ADMIN / RECEPTIONIST / MANAGER — operational overview
    // ---------------------------------------------------------------------
    if (role === UserRole.ADMIN || role === UserRole.RECEPTIONIST || role === UserRole.MANAGER) {
      // High-risk appointments awaiting confirmation across the whole hospital
      const pendingConfirmation = await Appointment.countDocuments({
        status: 'pending_confirmation',
        date: { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) },
      });

      if (pendingConfirmation > 0) {
        notifications.push({
          id: `pending-confirm-${startOfDay(now).toISOString()}`,
          type: 'urgent',
          title: `${pendingConfirmation} appointment${pendingConfirmation === 1 ? '' : 's'} awaiting confirmation`,
          message: 'High-risk patients have been notified — follow up if needed',
          link: '/no-show-alerts',
          timestamp: now.toISOString(),
        });
      }

      // High-risk appointments coming up
      const highRiskCount = await Appointment.countDocuments({
        date: { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) },
        riskScore: { $gte: 0.6 },
        status: { $in: ['scheduled', 'pending_confirmation'] },
      });

      if (highRiskCount > 0) {
        notifications.push({
          id: `highrisk-overview-${startOfDay(now).toISOString()}`,
          type: 'warning',
          title: `${highRiskCount} high-risk appointment${highRiskCount === 1 ? '' : 's'} this week`,
          message: 'Review the no-show alerts dashboard',
          link: '/no-show-alerts',
          timestamp: now.toISOString(),
        });
      }

      // Today's volume — purely informational
      const todayCount = await Appointment.countDocuments({
        date: { $gte: startOfDay(now), $lte: endOfDay(now) },
        status: { $in: ['scheduled', 'confirmed', 'in_progress', 'completed'] },
      });

      if (todayCount > 0) {
        notifications.push({
          id: `today-volume-${startOfDay(now).toISOString()}`,
          type: 'info',
          title: `${todayCount} appointment${todayCount === 1 ? '' : 's'} scheduled today`,
          message: 'Operational overview',
          link: '/appointments',
          timestamp: now.toISOString(),
        });
      }

      // Walk-in queue — receptionist & admin only (manager doesn't manage queue)
      if (role === UserRole.ADMIN || role === UserRole.RECEPTIONIST) {
        const waiting = await WalkInQueue.countDocuments({ status: 'waiting' });
        if (waiting > 0) {
          notifications.push({
            id: `walkin-waiting-${startOfDay(now).toISOString()}`,
            type: 'warning',
            title: `${waiting} walk-in patient${waiting === 1 ? '' : 's'} waiting`,
            message: 'Review walk-in queue',
            link: '/walk-in',
            timestamp: now.toISOString(),
          });
        }
      }
    }

    // ---------------------------------------------------------------------
    // NURSE — limited scope: walk-in queue + appointments today
    // ---------------------------------------------------------------------
    if (role === UserRole.NURSE) {
      const waiting = await WalkInQueue.countDocuments({ status: 'waiting' });
      if (waiting > 0) {
        notifications.push({
          id: `nurse-walkin-${startOfDay(now).toISOString()}`,
          type: 'info',
          title: `${waiting} walk-in patient${waiting === 1 ? '' : 's'} waiting`,
          message: 'Triage queue',
          link: '/walk-in',
          timestamp: now.toISOString(),
        });
      }
    }

    // Newest first
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      data: notifications,
      meta: { count: notifications.length, role },
    });
  } catch (error) {
    logger.error('getNotifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};