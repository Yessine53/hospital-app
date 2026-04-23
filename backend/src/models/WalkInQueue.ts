import mongoose, { Document, Schema } from 'mongoose';

export enum QueueStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

export interface IWalkInQueue extends Document {
  patientId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  doctorId?: mongoose.Types.ObjectId;
  queueNumber: number;
  status: QueueStatus;
  priority: 'normal' | 'urgent' | 'emergency';
  reason: string;
  checkedInAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  estimatedWaitMinutes?: number;
  appointmentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const walkInQueueSchema = new Schema<IWalkInQueue>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    queueNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(QueueStatus),
      default: QueueStatus.WAITING,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal',
    },
    reason: { type: String, required: true },
    checkedInAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    completedAt: { type: Date },
    estimatedWaitMinutes: { type: Number },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  },
  { timestamps: true }
);

walkInQueueSchema.index({ departmentId: 1, status: 1, createdAt: 1 });
walkInQueueSchema.index({ patientId: 1 });

export default mongoose.model<IWalkInQueue>('WalkInQueue', walkInQueueSchema);
