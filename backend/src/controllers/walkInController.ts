import { Request, Response } from 'express';
import WalkInQueue, { QueueStatus } from '../models/WalkInQueue';
import Appointment, { AppointmentStatus, AppointmentType } from '../models/Appointment';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const addToQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { patientId, departmentId, doctorId, priority, reason } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get next queue number for today in this department
    const lastInQueue = await WalkInQueue.findOne({
      departmentId,
      createdAt: { $gte: today, $lt: tomorrow },
    }).sort({ queueNumber: -1 });

    const queueNumber = (lastInQueue?.queueNumber || 0) + 1;

    // Estimate wait time
    const waitingCount = await WalkInQueue.countDocuments({
      departmentId,
      status: { $in: [QueueStatus.WAITING, QueueStatus.CALLED] },
      createdAt: { $gte: today },
    });

    const estimatedWaitMinutes = waitingCount * 25; // ~25 min per patient average

    const queueEntry = await WalkInQueue.create({
      patientId,
      departmentId,
      doctorId,
      queueNumber,
      priority: priority || 'normal',
      reason,
      estimatedWaitMinutes,
    });

    // Also create a walk-in appointment record
    const appointment = await Appointment.create({
      patientId,
      doctorId: doctorId || req.user!._id,
      departmentId,
      date: new Date(),
      startTime: new Date().toTimeString().slice(0, 5),
      endTime: '--:--',
      duration: 30,
      type: AppointmentType.WALK_IN,
      status: AppointmentStatus.SCHEDULED,
      reason,
      bookedBy: req.user!._id,
      bookingSource: 'walk_in',
      queueNumber,
    });

    queueEntry.appointmentId = appointment._id;
    await queueEntry.save();

    const populated = await WalkInQueue.findById(queueEntry._id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName' } })
      .populate('departmentId', 'name');

    res.status(201).json({
      message: `Added to queue. Queue number: ${queueNumber}`,
      data: { queueEntry: populated, estimatedWaitMinutes },
    });
  } catch (error) {
    logger.error('Add to queue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { departmentId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queue = await WalkInQueue.find({
      departmentId,
      createdAt: { $gte: today },
      status: { $in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_PROGRESS] },
    })
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName' } })
      .populate('doctorId', 'firstName lastName')
      .sort({ priority: -1, queueNumber: 1 });

    res.json({ data: queue });
  } catch (error) {
    logger.error('Get queue error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const callNext = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { departmentId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next waiting patient (priority first, then queue number)
    const next = await WalkInQueue.findOne({
      departmentId,
      createdAt: { $gte: today },
      status: QueueStatus.WAITING,
    }).sort({ priority: -1, queueNumber: 1 });

    if (!next) {
      res.status(404).json({ message: 'No patients waiting in queue' });
      return;
    }

    next.status = QueueStatus.CALLED;
    next.calledAt = new Date();
    await next.save();

    const populated = await WalkInQueue.findById(next._id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName' } });

    res.json({ message: `Calling queue number ${next.queueNumber}`, data: populated });
  } catch (error) {
    logger.error('Call next error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateQueueStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const entry = await WalkInQueue.findById(req.params.id);

    if (!entry) {
      res.status(404).json({ message: 'Queue entry not found' });
      return;
    }

    entry.status = status;
    if (status === QueueStatus.COMPLETED) {
      entry.completedAt = new Date();
      // Update the linked appointment too
      if (entry.appointmentId) {
        await Appointment.findByIdAndUpdate(entry.appointmentId, {
          status: AppointmentStatus.COMPLETED,
          completedAt: new Date(),
        });
      }
    }
    await entry.save();

    res.json({ message: 'Queue status updated', data: entry });
  } catch (error) {
    logger.error('Update queue status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
