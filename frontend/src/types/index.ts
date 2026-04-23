export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'nurse' | 'patient' | 'data_analyst' | 'manager';

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  departmentId?: Department;
  specialtyId?: Specialty;
  lastLogin?: string;
  fullName: string;
  createdAt: string;
}

export interface Patient {
  _id: string;
  userId: User;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodType?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  insuranceInfo?: InsuranceInfo;
  medicalNotes?: string;
  allergies?: string[];
  communicationPreference: 'email' | 'sms' | 'both';
  noShowCount: number;
  totalAppointments: number;
  attendedAppointments: number;
  cancelledAppointments: number;
  noShowRate: number;
  age: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  expiryDate: string;
}

export interface Department {
  _id: string;
  name: string;
  description?: string;
  code: string;
  floor?: string;
  phone?: string;
  email?: string;
  headOfDepartment?: User;
  defaultSlotDuration: number;
  operatingHours: OperatingHour[];
  specialties?: Specialty[];
  isActive: boolean;
}

export interface OperatingHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
}

export interface Specialty {
  _id: string;
  name: string;
  description?: string;
  departmentId: string | Department;
  defaultSlotDuration: number;
  isActive: boolean;
}

export type AppointmentStatus =
  | 'scheduled' | 'confirmed' | 'pending_confirmation' | 'checked_in'
  | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  | 'rescheduled' | 'reallocated';

export type AppointmentType = 'regular' | 'follow_up' | 'walk_in' | 'emergency' | 'consultation' | 'procedure';

export interface Appointment {
  _id: string;
  patientId: Patient;
  doctorId: User;
  departmentId: Department;
  specialtyId?: Specialty;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  confirmationRequired: boolean;
  confirmationDeadline?: string;
  confirmedAt?: string;
  queueNumber?: number;
  bookingSource: 'online' | 'receptionist' | 'walk_in';
  createdAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface WalkInEntry {
  _id: string;
  patientId: Patient;
  departmentId: Department;
  doctorId?: User;
  queueNumber: number;
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'cancelled' | 'skipped';
  priority: 'normal' | 'urgent' | 'emergency';
  reason: string;
  checkedInAt: string;
  calledAt?: string;
  estimatedWaitMinutes?: number;
}

export interface DashboardStats {
  today: { total: number; completed: number; noShows: number; pending: number };
  weekTotal: number;
  highRiskUpcoming: number;
  totalPatients: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  pagination?: Pagination;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}
