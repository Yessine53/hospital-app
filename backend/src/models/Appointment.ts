import mongoose, { Document, Schema } from 'mongoose';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  PENDING_CONFIRMATION = 'pending_confirmation',
  CHECKED_IN = 'checked_in',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
  REALLOCATED = 'reallocated',
}

export enum AppointmentType {
  REGULAR = 'regular',
  FOLLOW_UP = 'follow_up',
  WALK_IN = 'walk_in',
  EMERGENCY = 'emergency',
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
}

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  specialtyId?: mongoose.Types.ObjectId;
  date: Date;
  startTime: string; // "09:00"
  endTime: string; // "09:30"
  duration: number; // minutes
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  // No-show prediction
  riskScore?: number; // 0-1 probability
  riskLevel?: 'low' | 'medium' | 'high';
  predictionTimestamp?: Date;
  // Confirmation workflow
  confirmationRequired: boolean;
  confirmationDeadline?: Date;
  confirmedAt?: Date;
  // Reallocation
  reallocatedFrom?: mongoose.Types.ObjectId; // original appointment
  reallocatedTo?: mongoose.Types.ObjectId; // new appointment
  // Walk-in specific
  queueNumber?: number;
  queuePosition?: number;
  // Booking info
  bookedBy: mongoose.Types.ObjectId; // who created the appointment
  bookingSource: 'online' | 'receptionist' | 'walk_in';
  // Outcome
  checkedInAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    specialtyId: {
      type: Schema.Types.ObjectId,
      ref: 'Specialty',
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, default: 30 },
    type: {
      type: String,
      enum: Object.values(AppointmentType),
      default: AppointmentType.REGULAR,
    },
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: AppointmentStatus.SCHEDULED,
    },
    reason: { type: String },
    notes: { type: String },
    // No-show prediction
    riskScore: { type: Number, min: 0, max: 1 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
    },
    predictionTimestamp: { type: Date },
    // Confirmation workflow
    confirmationRequired: { type: Boolean, default: false },
    confirmationDeadline: { type: Date },
    confirmedAt: { type: Date },
    // Reallocation
    reallocatedFrom: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    reallocatedTo: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    // Walk-in
    queueNumber: { type: Number },
    queuePosition: { type: Number },
    // Booking
    bookedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingSource: {
      type: String,
      enum: ['online', 'receptionist', 'walk_in'],
      default: 'online',
    },
    // Outcome
    checkedInAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for common queries
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ departmentId: 1, date: 1 });
appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ riskLevel: 1, confirmationRequired: 1 });
appointmentSchema.index({ confirmationDeadline: 1 });

export default mongoose.model<IAppointment>('Appointment', appointmentSchema);
