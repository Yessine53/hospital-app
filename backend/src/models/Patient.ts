import mongoose, { Document, Schema } from 'mongoose';

export interface IPatient extends Document {
  userId: mongoose.Types.ObjectId;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  bloodType?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    expiryDate: Date;
  };
  medicalNotes?: string;
  allergies?: string[];
  communicationPreference: 'email' | 'sms' | 'both';
  noShowCount: number;
  totalAppointments: number;
  attendedAppointments: number;
  cancelledAppointments: number;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true,
    },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'Malta' },
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    insuranceInfo: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
    },
    medicalNotes: { type: String },
    allergies: [{ type: String }],
    communicationPreference: {
      type: String,
      enum: ['email', 'sms', 'both'],
      default: 'both',
    },
    noShowCount: { type: Number, default: 0 },
    totalAppointments: { type: Number, default: 0 },
    attendedAppointments: { type: Number, default: 0 },
    cancelledAppointments: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

patientSchema.virtual('noShowRate').get(function () {
  if (this.totalAppointments === 0) return 0;
  return this.noShowCount / this.totalAppointments;
});

patientSchema.virtual('age').get(function () {
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

patientSchema.index({ userId: 1 });

export default mongoose.model<IPatient>('Patient', patientSchema);
