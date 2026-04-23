import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', role, search, isActive } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const filter: any = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      const regex = new RegExp(search as string, 'i');
      filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
    }

    const users = await User.find(filter)
      .populate('departmentId', 'name code')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await User.countDocuments(filter);

    res.json({
      data: users,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, phone, departmentId, specialtyId } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      departmentId,
      specialtyId,
    });

    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json({ message: 'User created', data: userResponse });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, role, departmentId, specialtyId, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, phone, role, departmentId, specialtyId, isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ message: 'User updated', data: user });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Soft delete
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ message: 'User deactivated', data: user });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { departmentId, specialtyId } = req.query;
    const filter: any = { role: UserRole.DOCTOR, isActive: true };

    if (departmentId) filter.departmentId = departmentId;
    if (specialtyId) filter.specialtyId = specialtyId;

    const doctors = await User.find(filter)
      .select('firstName lastName email phone departmentId specialtyId')
      .populate('departmentId', 'name code')
      .populate('specialtyId', 'name')
      .sort({ lastName: 1 });

    res.json({ data: doctors });
  } catch (error) {
    logger.error('Get doctors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
