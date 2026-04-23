import { Request, Response } from 'express';
import SystemSettings, { DEFAULT_SETTINGS } from '../models/SystemSettings';
import AuditLog from '../models/AuditLog';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Initialize defaults if not present
export const initializeSettings = async (): Promise<void> => {
  try {
    const count = await SystemSettings.countDocuments();
    if (count === 0) {
      await SystemSettings.insertMany(DEFAULT_SETTINGS);
      logger.info(`Initialized ${DEFAULT_SETTINGS.length} default system settings`);
    }
  } catch (error) {
    logger.error('Settings initialization error:', error);
  }
};

// Get all settings grouped by category
export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SystemSettings.find()
      .populate('updatedBy', 'firstName lastName')
      .sort({ category: 1, key: 1 });

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }

    res.json({ data: { settings, grouped } });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a single setting
export const updateSetting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      res.status(400).json({ message: 'Key and value are required' });
      return;
    }

    const setting = await SystemSettings.findOneAndUpdate(
      { key },
      { value, updatedBy: req.user!._id },
      { new: true, runValidators: true }
    );

    if (!setting) {
      res.status(404).json({ message: `Setting '${key}' not found` });
      return;
    }

    // Audit log
    await AuditLog.create({
      userId: req.user!._id,
      action: 'update_setting',
      entity: 'SystemSettings',
      entityId: setting._id,
      details: { key, newValue: value },
      ipAddress: req.ip,
    });

    res.json({ message: 'Setting updated', data: setting });
  } catch (error) {
    logger.error('Update setting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk update settings
export const updateSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { updates } = req.body; // Array of { key, value }

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ message: 'Updates array is required' });
      return;
    }

    const results = [];
    for (const { key, value } of updates) {
      const setting = await SystemSettings.findOneAndUpdate(
        { key },
        { value, updatedBy: req.user!._id },
        { new: true }
      );
      if (setting) results.push(setting);
    }

    await AuditLog.create({
      userId: req.user!._id,
      action: 'bulk_update_settings',
      entity: 'SystemSettings',
      details: { keys: updates.map((u: any) => u.key) },
      ipAddress: req.ip,
    });

    res.json({ message: `Updated ${results.length} settings`, data: results });
  } catch (error) {
    logger.error('Bulk update settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single setting by key (public for frontend config)
export const getSettingByKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key });
    if (!setting) {
      res.status(404).json({ message: 'Setting not found' });
      return;
    }
    res.json({ data: setting });
  } catch (error) {
    logger.error('Get setting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get audit logs
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1', limit = '50', entity, action, userId, startDate, endDate,
    } = req.query;

    const filter: any = {};
    if (entity) filter.entity = entity;
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const logs = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await AuditLog.countDocuments(filter);

    res.json({
      data: logs,
      pagination: {
        page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
