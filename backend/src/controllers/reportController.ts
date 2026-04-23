import { Request, Response } from 'express';
import Appointment, { AppointmentStatus } from '../models/Appointment';
import Patient from '../models/Patient';
import Reminder from '../models/Reminder';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getNoShowReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, departmentId } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const matchStage: any = { date: { $gte: start, $lte: end } };
    if (departmentId) matchStage.departmentId = departmentId;

    const stats = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.NO_SHOW] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.CANCELLED] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.CONFIRMED] }, 1, 0] } },
        },
      },
    ]);

    // Daily breakdown
    const dailyBreakdown = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.NO_SHOW] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.COMPLETED] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Department breakdown
    const departmentBreakdown = await Appointment.aggregate([
      { $match: matchStage },
      {
        $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'dept' },
      },
      { $unwind: '$dept' },
      {
        $group: {
          _id: '$dept.name',
          total: { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.NO_SHOW] }, 1, 0] } },
        },
      },
      { $sort: { noShows: -1 } },
    ]);

    // Risk prediction accuracy
    const predictionAccuracy = await Appointment.aggregate([
      {
        $match: {
          ...matchStage,
          riskScore: { $exists: true },
          status: { $in: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW] },
        },
      },
      {
        $group: {
          _id: '$riskLevel',
          total: { $sum: 1 },
          actualNoShows: {
            $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.NO_SHOW] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      data: {
        summary: stats[0] || { total: 0, noShows: 0, attended: 0, cancelled: 0, confirmed: 0 },
        noShowRate: stats[0] ? ((stats[0].noShows / stats[0].total) * 100).toFixed(1) : 0,
        dailyBreakdown,
        departmentBreakdown,
        predictionAccuracy,
      },
    });
  } catch (error) {
    logger.error('No-show report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getReminderReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await Reminder.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$channel',
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          responded: { $sum: { $cond: [{ $eq: ['$status', 'responded'] }, 1, 0] } },
        },
      },
    ]);

    const responseBreakdown = await Reminder.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, response: { $ne: null } } },
      { $group: { _id: '$response', count: { $sum: 1 } } },
    ]);

    res.json({ data: { channelStats: stats, responseBreakdown } });
  } catch (error) {
    logger.error('Reminder report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOverviewReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalPatients, totalDoctors, monthlyAppointments, upcomingHighRisk] = await Promise.all([
      Patient.countDocuments(),
      (await import('../models/User')).default.countDocuments({ role: 'doctor', isActive: true }),
      Appointment.countDocuments({ date: { $gte: thirtyDaysAgo } }),
      Appointment.countDocuments({
        date: { $gte: new Date() },
        riskLevel: 'high',
        status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.PENDING_CONFIRMATION] },
      }),
    ]);

    // Trend: appointments per week for last 8 weeks
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const weeklyTrend = await Appointment.aggregate([
      { $match: { date: { $gte: eightWeeksAgo } } },
      {
        $group: {
          _id: { $week: '$date' },
          total: { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', AppointmentStatus.NO_SHOW] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      data: {
        totalPatients,
        totalDoctors,
        monthlyAppointments,
        upcomingHighRisk,
        weeklyTrend,
      },
    });
  } catch (error) {
    logger.error('Overview report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
