export { default as User, UserRole } from './User';
export type { IUser } from './User';

export { default as Patient } from './Patient';
export type { IPatient } from './Patient';

export { Department, Specialty } from './Department';
export type { IDepartment, ISpecialty } from './Department';

export { default as Appointment, AppointmentStatus, AppointmentType } from './Appointment';
export type { IAppointment } from './Appointment';

export { default as Reminder, ReminderType, ReminderChannel, ReminderStatus } from './Reminder';
export type { IReminder } from './Reminder';

export { default as AuditLog } from './AuditLog';
export type { IAuditLog } from './AuditLog';

export { default as WalkInQueue, QueueStatus } from './WalkInQueue';
export type { IWalkInQueue } from './WalkInQueue';

export { default as SystemSettings } from './SystemSettings';
