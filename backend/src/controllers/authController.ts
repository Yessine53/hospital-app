import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/User';
import Patient from '../models/Patient';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const generateToken = (userId: string, role: string): string => {
  const secret: jwt.Secret = process.env.JWT_SECRET || 'fallback-secret';
  return jwt.sign(
    { userId, role },
    secret,
    { expiresIn: 7 * 24 * 60 * 60 } // 7 days in seconds
  );
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id.toString(), user.role);

    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.json({
      message: 'Login successful',
      data: { user: userResponse, token },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email, password, firstName, lastName, phone,
      dateOfBirth, gender, address, communicationPreference,
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: UserRole.PATIENT,
    });

    await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      address,
      communicationPreference: communicationPreference || 'both',
    });

    const token = generateToken(user._id.toString(), user.role);

    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json({
      message: 'Registration successful',
      data: { user: userResponse, token },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id)
      .populate('departmentId', 'name code')
      .populate('specialtyId', 'name');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    let patientProfile = null;
    if (user.role === UserRole.PATIENT) {
      patientProfile = await Patient.findOne({ userId: user._id });
    }

    res.json({
      data: { user, patientProfile },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );

    if (req.user!.role === UserRole.PATIENT) {
      const { address, communicationPreference, emergencyContact } = req.body;
      await Patient.findOneAndUpdate(
        { userId: req.user!._id },
        { address, communicationPreference, emergencyContact },
        { new: true }
      );
    }

    res.json({ message: 'Profile updated', data: { user } });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user!._id).select('+password');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
