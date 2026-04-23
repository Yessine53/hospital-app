import { Request, Response } from 'express';
import Patient from '../models/Patient';
import User, { UserRole } from '../models/User';
import Appointment from '../models/Appointment';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getPatients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    let userFilter: any = { role: UserRole.PATIENT, isActive: true };
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      userFilter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ];
    }

    const users = await User.find(userFilter).select('_id');
    const userIds = users.map((u) => u._id);

    const patients = await Patient.find({ userId: { $in: userIds } })
      .populate('userId', 'firstName lastName email phone isActive')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Patient.countDocuments({ userId: { $in: userIds } });

    res.json({
      data: patients,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Get patients error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone isActive');

    if (!patient) {
      res.status(404).json({ message: 'Patient not found' });
      return;
    }

    // Get recent appointments
    const recentAppointments = await Appointment.find({ patientId: patient._id })
      .populate('doctorId', 'firstName lastName')
      .populate('departmentId', 'name')
      .sort({ date: -1 })
      .limit(10);

    res.json({ data: { patient, recentAppointments } });
  } catch (error) {
    logger.error('Get patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createPatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      email, firstName, lastName, phone, password,
      dateOfBirth, gender, bloodType, address,
      emergencyContact, insuranceInfo, communicationPreference, allergies,
    } = req.body;

    // Create user account
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const user = await User.create({
      email,
      password: password || 'TempPass123!',
      firstName,
      lastName,
      phone,
      role: UserRole.PATIENT,
    });

    const patient = await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      bloodType,
      address,
      emergencyContact,
      insuranceInfo,
      communicationPreference: communicationPreference || 'both',
      allergies,
    });

    const populated = await Patient.findById(patient._id)
      .populate('userId', 'firstName lastName email phone');

    res.status(201).json({ message: 'Patient created', data: populated });
  } catch (error) {
    logger.error('Create patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      firstName, lastName, phone, dateOfBirth, gender,
      bloodType, address, emergencyContact, insuranceInfo,
      communicationPreference, allergies, medicalNotes,
    } = req.body;

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      res.status(404).json({ message: 'Patient not found' });
      return;
    }

    // Update user
    if (firstName || lastName || phone) {
      await User.findByIdAndUpdate(patient.userId, {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
      });
    }

    // Update patient
    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      {
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender && { gender }),
        ...(bloodType && { bloodType }),
        ...(address && { address }),
        ...(emergencyContact && { emergencyContact }),
        ...(insuranceInfo && { insuranceInfo }),
        ...(communicationPreference && { communicationPreference }),
        ...(allergies && { allergies }),
        ...(medicalNotes !== undefined && { medicalNotes }),
      },
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email phone');

    res.json({ message: 'Patient updated', data: updated });
  } catch (error) {
    logger.error('Update patient error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPatientHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointments = await Appointment.find({ patientId: req.params.id })
      .populate('doctorId', 'firstName lastName')
      .populate('departmentId', 'name code')
      .sort({ date: -1 });

    const stats = {
      total: appointments.length,
      attended: appointments.filter((a) => a.status === 'completed').length,
      noShows: appointments.filter((a) => a.status === 'no_show').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    };

    res.json({ data: { appointments, stats } });
  } catch (error) {
    logger.error('Get patient history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
