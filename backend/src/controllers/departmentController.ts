import { Request, Response } from 'express';
import { Department, Specialty } from '../models/Department';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const getDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate('specialties')
      .populate('headOfDepartment', 'firstName lastName')
      .sort({ name: 1 });

    res.json({ data: departments });
  } catch (error) {
    logger.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('specialties')
      .populate('headOfDepartment', 'firstName lastName');

    if (!department) {
      res.status(404).json({ message: 'Department not found' });
      return;
    }

    // Get doctors in this department
    const doctors = await User.find({
      departmentId: department._id,
      role: 'doctor',
      isActive: true,
    }).select('firstName lastName email specialtyId');

    res.json({ data: { department, doctors } });
  } catch (error) {
    logger.error('Get department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const department = await Department.create(req.body);
    res.status(201).json({ message: 'Department created', data: department });
  } catch (error) {
    logger.error('Create department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!department) {
      res.status(404).json({ message: 'Department not found' });
      return;
    }

    res.json({ message: 'Department updated', data: department });
  } catch (error) {
    logger.error('Update department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Specialty CRUD
export const getSpecialties = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { isActive: true };
    if (req.query.departmentId) filter.departmentId = req.query.departmentId;

    const specialties = await Specialty.find(filter)
      .populate('departmentId', 'name code')
      .sort({ name: 1 });

    res.json({ data: specialties });
  } catch (error) {
    logger.error('Get specialties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const specialty = await Specialty.create(req.body);
    res.status(201).json({ message: 'Specialty created', data: specialty });
  } catch (error) {
    logger.error('Create specialty error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSpecialty = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const specialty = await Specialty.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!specialty) {
      res.status(404).json({ message: 'Specialty not found' });
      return;
    }

    res.json({ message: 'Specialty updated', data: specialty });
  } catch (error) {
    logger.error('Update specialty error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDoctorsByDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctors = await User.find({
      departmentId: req.params.departmentId,
      role: 'doctor',
      isActive: true,
    })
      .select('firstName lastName email phone specialtyId')
      .populate('specialtyId', 'name');

    res.json({ data: doctors });
  } catch (error) {
    logger.error('Get doctors by department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
