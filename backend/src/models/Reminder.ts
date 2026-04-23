import mongoose, { Document, Schema } from 'mongoose';

export enum ReminderType {
  STANDARD = 'standard',
  CONFIRMATION_REQUEST = 'confirmation_request',
  REALLOCATION_OFFER = 'reallocation_offer',
  APPOINTMENT_MOVED = 'appointment_moved',
  CANCELLATION = 'cancellation',
}

export enum ReminderChannel {
  EMAIL = 'email',
  SMS = 'sms',
}

export enum ReminderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RESPONDED = 'responded',
}

export interface IReminder extends Document {
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  type: ReminderType;
  channel: ReminderChannel;
  status: ReminderStatus;
  scheduledFor: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  response?: 'confirmed' | 'cancelled' | 'rescheduled' | null;
  respondedAt?: Date;
  messageContent: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<IReminder>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ReminderType),
      required: true,
    },
    channel: {
      type: String,
      enum: Object.values(ReminderChannel),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReminderStatus),
      default: ReminderStatus.PENDING,
    },
    scheduledFor: { type: Date, required: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    response: {
      type: String,
      enum: ['confirmed', 'cancelled', 'rescheduled', null],
    },
    respondedAt: { type: Date },
    messageContent: { type: String, required: true },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reminderSchema.index({ appointmentId: 1 });
reminderSchema.index({ patientId: 1 });
reminderSchema.index({ scheduledFor: 1, status: 1 });

export default mongoose.model<IReminder>('Reminder', reminderSchema);
