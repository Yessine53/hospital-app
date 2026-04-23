import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string;
  value: any;
  category: 'general' | 'prediction' | 'reminders' | 'notifications' | 'scheduling';
  label: string;
  description?: string;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    category: {
      type: String,
      enum: ['general', 'prediction', 'reminders', 'notifications', 'scheduling'],
      required: true,
    },
    label: { type: String, required: true },
    description: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

systemSettingsSchema.index({ category: 1 });

// Default settings to seed on first run
export const DEFAULT_SETTINGS = [
  // General
  {
    key: 'hospital_name', value: 'MedBook General Hospital',
    category: 'general', label: 'Hospital Name',
    description: 'Displayed in headers and notifications',
  },
  {
    key: 'hospital_phone', value: '+356 2123 4567',
    category: 'general', label: 'Hospital Phone',
    description: 'Main contact number',
  },
  {
    key: 'hospital_email', value: 'info@medbook.hospital',
    category: 'general', label: 'Hospital Email',
    description: 'Main contact email',
  },
  {
    key: 'hospital_address', value: 'Republic Street, Valletta VLT 1000, Malta',
    category: 'general', label: 'Hospital Address',
  },
  // Prediction thresholds
  {
    key: 'risk_threshold_high', value: 0.6,
    category: 'prediction', label: 'High Risk Threshold',
    description: 'Appointments with no-show probability above this are flagged high risk (0-1)',
  },
  {
    key: 'risk_threshold_medium', value: 0.3,
    category: 'prediction', label: 'Medium Risk Threshold',
    description: 'Appointments with no-show probability above this are flagged medium risk (0-1)',
  },
  {
    key: 'auto_flag_high_risk', value: true,
    category: 'prediction', label: 'Auto-Flag High Risk',
    description: 'Automatically require confirmation for high-risk appointments',
  },
  // Reminder settings
  {
    key: 'reminder_days_before', value: 2,
    category: 'reminders', label: 'Reminder Days Before',
    description: 'Send confirmation request this many days before the appointment',
  },
  {
    key: 'confirmation_deadline_hours', value: 24,
    category: 'reminders', label: 'Confirmation Deadline (hours)',
    description: 'Hours the patient has to confirm before slot is reallocated',
  },
  {
    key: 'enable_email_reminders', value: true,
    category: 'reminders', label: 'Enable Email Reminders',
    description: 'Send reminders via email',
  },
  {
    key: 'enable_sms_reminders', value: true,
    category: 'reminders', label: 'Enable SMS Reminders',
    description: 'Send reminders via SMS (requires Twilio configuration)',
  },
  // Scheduling
  {
    key: 'default_slot_duration', value: 30,
    category: 'scheduling', label: 'Default Slot Duration (min)',
    description: 'Default appointment duration in minutes',
  },
  {
    key: 'max_advance_booking_days', value: 90,
    category: 'scheduling', label: 'Max Advance Booking (days)',
    description: 'How far in advance patients can book appointments',
  },
  {
    key: 'enable_walk_ins', value: true,
    category: 'scheduling', label: 'Enable Walk-In Queue',
    description: 'Allow walk-in patients through the queue system',
  },
  {
    key: 'auto_reallocate_slots', value: true,
    category: 'scheduling', label: 'Auto-Reallocate Unconfirmed Slots',
    description: 'Automatically offer unconfirmed high-risk slots to next-day patients',
  },
];

export default mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);
