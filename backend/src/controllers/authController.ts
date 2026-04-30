import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/User';
import Patient from '../models/Patient';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Same rule as in auth.ts: refuse to start without a JWT secret. This file
// reads it independently so the controller can be imported in isolation
// (e.g. for unit tests) without depending on the middleware module.
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const SECRET: jwt.Secret = JWT_SECRET as string;

const generateToken = (userId: string, role: string): string => {
  return jwt.sign(
    { userId, role },
    SECRET,
    { expiresIn: 7 * 24 * 60 * 60 } // 7 days in seconds
  );
};

// Tiny helper — keeps email validation predictable and out of the request handlers.
const isValidEmail = (email: string): boolean =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    // Reject malformed input early so we don't burn a DB roundtrip on garbage.
    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

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
    } = req.body ?? {};

    // Required-field validation. Mongoose would catch most of these at save
    // time, but returning a clear 400 is friendlier and avoids ambiguous 500s.
    if (!isValidEmail(email)) {
      res.status(400).json({ message: 'A valid email is required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }
    if (!firstName || !lastName) {
      res.status(400).json({ message: 'First name and last name are required' });
      return;
    }
    if (!dateOfBirth || !gender) {
      res.status(400).json({ message: 'Date of birth and gender are required' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    // Public registration is always PATIENT — staff roles are created via
    // the admin-only /api/users endpoint. Never trust a client-supplied role.
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
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ message: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ message: 'New password must be at least 8 characters' });
      return;
    }

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