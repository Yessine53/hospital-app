import { Request, Response } from 'express';
import Appointment, { AppointmentStatus, AppointmentType } from '../models/Appointment';
import Patient from '../models/Patient';
import { Department } from '../models/Department';
import User, { UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import axios from 'axios';

// Get available slots for a doctor on a specific date
export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId, date, departmentId } = req.query;

    if (!doctorId || !date) {
      res.status(400).json({ message: 'doctorId and date are required' });
      return;
    }

    const queryDate = new Date(date as string);
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    // Get department operating hours
    const dept = await Department.findById(departmentId);
    const dayOfWeek = new Date(date as string).getDay();
    const opHours = dept?.operatingHours?.find((h) => h.dayOfWeek === dayOfWeek);

    const startHour = opHours?.startTime || '08:00';
    const endHour = opHours?.endTime || '17:00';
    const slotDuration = dept?.defaultSlotDuration || 30;

    // Get existing appointments for that doctor on that date
    const existingAppointments = await Appointment.find({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
    }).select('startTime endTime');

    const bookedTimes = new Set(existingAppointments.map((a) => a.startTime));

    // Generate all possible slots
    const slots: { startTime: string; endTime: string; available: boolean }[] = [];
    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + slotDuration <= endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const startTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

      const endSlotMinutes = currentMinutes + slotDuration;
      const endHours = Math.floor(endSlotMinutes / 60);
      const endMins = endSlotMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

      slots.push({
        startTime,
        endTime,
        available: !bookedTimes.has(startTime),
      });

      currentMinutes += slotDuration;
    }

    res.json({ data: { slots, date: date, doctorId } });
  } catch (error) {
    logger.error('Get available slots error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create appointment (online booking or receptionist)
export const createAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      patientId, doctorId, departmentId, specialtyId,
      date, startTime, endTime, duration, type, reason, notes,
      bookingSource,
    } = req.body;

    // Verify no conflict
    const conflict = await Appointment.findOne({
      doctorId,
      date: new Date(date),
      startTime,
      status: { $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
    });

    if (conflict) {
      res.status(409).json({ message: 'This time slot is already booked' });
      return;
    }

    const appointment = await Appointment.create({
      patientId,
      doctorId,
      departmentId,
      specialtyId,
      date: new Date(date),
      startTime,
      endTime: endTime || calculateEndTime(startTime, duration || 30),
      duration: duration || 30,
      type: type || AppointmentType.REGULAR,
      status: AppointmentStatus.SCHEDULED,
      reason,
      notes,
      bookedBy: req.user!._id,
      bookingSource: bookingSource || (req.user!.role === UserRole.PATIENT ? 'online' : 'receptionist'),
    });

    // Update patient stats
    await Patient.findByIdAndUpdate(patientId, { $inc: { totalAppointments: 1 } });

    // Request no-show prediction from ML service
    try {
      const mlResponse = await axios.post(
        `${process.env.ML_SERVICE_URL}/predict`,
        {
          appointmentId: appointment._id.toString(),
          patientId: patientId,
          doctorId,
          departmentId,
          date,
          startTime,
          type: type || 'regular',
        }
      );

      if (mlResponse.data?.riskScore !== undefined) {
        appointment.riskScore = mlResponse.data.riskScore;
        appointment.riskLevel = mlResponse.data.riskLevel;
        appointment.predictionTimestamp = new Date();

        // If high risk, flag for confirmation 2 days before
        if (mlResponse.data.riskLevel === 'high') {
          const appointmentDate = new Date(date);
          const confirmDeadline = new Date(appointmentDate);
          confirmDeadline.setDate(confirmDeadline.getDate() - 2);
          confirmDeadline.setHours(23, 59, 59);

          appointment.confirmationRequired = true;
          appointment.confirmationDeadline = confirmDeadline;
        }

        await appointment.save();
      }
    } catch (mlError) {
      logger.warn('ML prediction service unavailable, continuing without prediction');
    }

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patientId')
      .populate('doctorId', 'firstName lastName email')
      .populate('departmentId', 'name code');

    res.status(201).json({
      message: 'Appointment created successfully',
      data: populatedAppointment,
    });
  } catch (error) {
    logger.error('Create appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get appointments (filtered by role)
export const getAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '20', status, date, startDate, endDate,
      doctorId, departmentId, patientId, riskLevel,
    } = req.query;

    const filter: any = {};

    // Role-based filtering
    if (req.user!.role === UserRole.PATIENT) {
      const patient = await Patient.findOne({ userId: req.user!._id });
      if (!patient) {
        res.status(404).json({ message: 'Patient profile not found' });
        return;
      }
      filter.patientId = patient._id;
    } else if (req.user!.role === UserRole.DOCTOR) {
      filter.doctorId = req.user!._id;
    }

    // Query params
    if (status) filter.status = status;
    if (doctorId && req.user!.role !== UserRole.DOCTOR) filter.doctorId = doctorId;
    if (departmentId) filter.departmentId = departmentId;
    if (patientId && req.user!.role !== UserRole.PATIENT) filter.patientId = patientId;
    if (riskLevel) filter.riskLevel = riskLevel;

    if (date) {
      const d = new Date(date as string);
      filter.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    } else if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate as string), $lte: new Date(endDate as string) };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const appointments = await Appointment.find(filter)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('doctorId', 'firstName lastName email')
      .populate('departmentId', 'name code')
      .populate('specialtyId', 'name')
      .sort({ date: 1, startTime: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Appointment.countDocuments(filter);

    res.json({
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get appointments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single appointment
export const getAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('doctorId', 'firstName lastName email')
      .populate('departmentId', 'name code')
      .populate('specialtyId', 'name');

    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    res.json({ data: appointment });
  } catch (error) {
    logger.error('Get appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update appointment
export const updateAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, notes, date, startTime, endTime, reason, cancellationReason } = req.body;
    const update: any = {};

    if (notes !== undefined) update.notes = notes;
    if (reason !== undefined) update.reason = reason;

    if (date && startTime) {
      // Check for conflicts
      const conflict = await Appointment.findOne({
        _id: { $ne: req.params.id },
        doctorId: (await Appointment.findById(req.params.id))?.doctorId,
        date: new Date(date),
        startTime,
        status: { $nin: [AppointmentStatus.CANCELLED, AppointmentStatus.RESCHEDULED] },
      });

      if (conflict) {
        res.status(409).json({ message: 'Time slot conflict' });
        return;
      }

      update.date = new Date(date);
      update.startTime = startTime;
      update.endTime = endTime || startTime;
    }

    if (status) {
      update.status = status;
      if (status === AppointmentStatus.CHECKED_IN) update.checkedInAt = new Date();
      if (status === AppointmentStatus.COMPLETED) update.completedAt = new Date();
      if (status === AppointmentStatus.CANCELLED) {
        update.cancelledAt = new Date();
        update.cancellationReason = cancellationReason;
      }
      if (status === AppointmentStatus.NO_SHOW) {
        const appt = await Appointment.findById(req.params.id);
        if (appt) {
          await Patient.findByIdAndUpdate(appt.patientId, { $inc: { noShowCount: 1 } });
        }
      }
      if (status === AppointmentStatus.COMPLETED) {
        const appt = await Appointment.findById(req.params.id);
        if (appt) {
          await Patient.findByIdAndUpdate(appt.patientId, { $inc: { attendedAppointments: 1 } });
        }
      }
    }

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    })
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email phone' } })
      .populate('doctorId', 'firstName lastName email')
      .populate('departmentId', 'name code');

    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    res.json({ message: 'Appointment updated', data: appointment });
  } catch (error) {
    logger.error('Update appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Confirm appointment (patient action via web app)
export const confirmAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    if (appointment.status === AppointmentStatus.CANCELLED ||
        appointment.status === AppointmentStatus.REALLOCATED) {
      res.status(400).json({ message: 'This appointment can no longer be confirmed' });
      return;
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    appointment.confirmedAt = new Date();
    appointment.confirmationRequired = false;
    await appointment.save();

    res.json({ message: 'Appointment confirmed successfully', data: appointment });
  } catch (error) {
    logger.error('Confirm appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Cancel appointment
export const cancelAppointment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = reason;
    await appointment.save();

    await Patient.findByIdAndUpdate(appointment.patientId, {
      $inc: { cancelledAppointments: 1 },
    });

    res.json({ message: 'Appointment cancelled', data: appointment });
  } catch (error) {
    logger.error('Cancel appointment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Dashboard stats
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseFilter: any = {};
    if (req.user!.role === UserRole.DOCTOR) {
      baseFilter.doctorId = req.user!._id;
    }

    const [
      todayTotal,
      todayCompleted,
      todayNoShows,
      todayPending,
      weekTotal,
      highRiskUpcoming,
      totalPatients,
    ] = await Promise.all([
      Appointment.countDocuments({ ...baseFilter, date: { $gte: today, $lt: tomorrow } }),
      Appointment.countDocuments({ ...baseFilter, date: { $gte: today, $lt: tomorrow }, status: AppointmentStatus.COMPLETED }),
      Appointment.countDocuments({ ...baseFilter, date: { $gte: today, $lt: tomorrow }, status: AppointmentStatus.NO_SHOW }),
      Appointment.countDocuments({ ...baseFilter, date: { $gte: today, $lt: tomorrow }, status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] } }),
      Appointment.countDocuments({
        ...baseFilter,
        date: { $gte: today, $lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
      }),
      Appointment.countDocuments({
        ...baseFilter,
        date: { $gte: today },
        riskLevel: 'high',
        status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.PENDING_CONFIRMATION] },
      }),
      Patient.countDocuments(),
    ]);

    res.json({
      data: {
        today: { total: todayTotal, completed: todayCompleted, noShows: todayNoShows, pending: todayPending },
        weekTotal,
        highRiskUpcoming,
        totalPatients,
      },
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

function calculateEndTime(startTime: string, duration: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + duration;
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}
