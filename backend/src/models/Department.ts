import mongoose, { Document, Schema } from 'mongoose';

export interface ISpecialty extends Document {
  name: string;
  description?: string;
  departmentId: mongoose.Types.ObjectId;
  defaultSlotDuration: number; // in minutes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDepartment extends Document {
  name: string;
  description?: string;
  code: string;
  floor?: string;
  phone?: string;
  email?: string;
  headOfDepartment?: mongoose.Types.ObjectId;
  defaultSlotDuration: number;
  operatingHours: {
    dayOfWeek: number; // 0=Sunday, 6=Saturday
    startTime: string; // "08:00"
    endTime: string; // "17:00"
    isOpen: boolean;
  }[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const specialtySchema = new Schema<ISpecialty>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    defaultSlotDuration: { type: Number, default: 30 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

specialtySchema.index({ departmentId: 1 });

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    code: { type: String, required: true, unique: true, uppercase: true },
    floor: { type: String },
    phone: { type: String },
    email: { type: String },
    headOfDepartment: { type: Schema.Types.ObjectId, ref: 'User' },
    defaultSlotDuration: { type: Number, default: 30 },
    operatingHours: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: { type: String, default: '08:00' },
        endTime: { type: String, default: '17:00' },
        isOpen: { type: Boolean, default: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

departmentSchema.virtual('specialties', {
  ref: 'Specialty',
  localField: '_id',
  foreignField: 'departmentId',
});

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
export const Specialty = mongoose.model<ISpecialty>('Specialty', specialtySchema);
