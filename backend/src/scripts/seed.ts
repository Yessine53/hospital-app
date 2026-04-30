import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { UserRole } from '../models/User';
import Patient from '../models/Patient';
import { Department, Specialty } from '../models/Department';
import Appointment, { AppointmentStatus, AppointmentType } from '../models/Appointment';

dotenv.config();

const _MONGODB_URI = process.env.MONGODB_URI;
if (!_MONGODB_URI) {
  console.error('FATAL: MONGODB_URI environment variable is not set.');
  console.error('Set it in backend/.env (see backend/.env.example) before running this script.');
  process.exit(1);
}
const MONGODB_URI: string = _MONGODB_URI as string;

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}), Patient.deleteMany({}),
    Department.deleteMany({}), Specialty.deleteMany({}),
    Appointment.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // 1. Create Departments
  const departments = await Department.create([
    {
      name: 'General Medicine', code: 'GM', floor: '1', description: 'Primary care and internal medicine',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '17:00', isOpen: d >= 1 && d <= 5 })),
    },
    {
      name: 'Cardiology', code: 'CARD', floor: '2', description: 'Heart and cardiovascular care',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '16:00', isOpen: d >= 1 && d <= 5 })),
    },
    {
      name: 'Dermatology', code: 'DERM', floor: '2', description: 'Skin conditions and treatments',
      defaultSlotDuration: 20,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '16:00', isOpen: d >= 1 && d <= 4 })),
    },
    {
      name: 'Orthopaedics', code: 'ORTH', floor: '3', description: 'Bones, joints, and musculoskeletal',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '17:00', isOpen: d >= 1 && d <= 5 })),
    },
    {
      name: 'Paediatrics', code: 'PAED', floor: '1', description: 'Children and adolescent healthcare',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({ dayOfWeek: d, startTime: '08:00', endTime: '16:00', isOpen: d >= 1 && d <= 5 })),
    },
  ]);
  console.log(`Created ${departments.length} departments`);

  // 2. Specialties
  const specialties = await Specialty.create([
    { name: 'Family Medicine', departmentId: departments[0]._id, defaultSlotDuration: 30 },
    { name: 'Internal Medicine', departmentId: departments[0]._id, defaultSlotDuration: 30 },
    { name: 'Interventional Cardiology', departmentId: departments[1]._id, defaultSlotDuration: 45 },
    { name: 'Electrophysiology', departmentId: departments[1]._id, defaultSlotDuration: 30 },
    { name: 'Cosmetic Dermatology', departmentId: departments[2]._id, defaultSlotDuration: 20 },
    { name: 'Medical Dermatology', departmentId: departments[2]._id, defaultSlotDuration: 20 },
    { name: 'Sports Medicine', departmentId: departments[3]._id, defaultSlotDuration: 30 },
    { name: 'Joint Replacement', departmentId: departments[3]._id, defaultSlotDuration: 45 },
    { name: 'Neonatology', departmentId: departments[4]._id, defaultSlotDuration: 30 },
  ]);
  console.log(`Created ${specialties.length} specialties`);

  // 3. Create Staff Users
  const admin = await User.create({
    email: 'admin@hospital.com', password: 'Admin123!', firstName: 'System', lastName: 'Admin',
    role: UserRole.ADMIN, phone: '+35612345678',
  });

  const doctors = await User.create([
    { email: 'dr.smith@hospital.com', password: 'Doctor123!', firstName: 'James', lastName: 'Smith', role: UserRole.DOCTOR, departmentId: departments[0]._id, specialtyId: specialties[0]._id, phone: '+35612345001' },
    { email: 'dr.johnson@hospital.com', password: 'Doctor123!', firstName: 'Sarah', lastName: 'Johnson', role: UserRole.DOCTOR, departmentId: departments[1]._id, specialtyId: specialties[2]._id, phone: '+35612345002' },
    { email: 'dr.chen@hospital.com', password: 'Doctor123!', firstName: 'Wei', lastName: 'Chen', role: UserRole.DOCTOR, departmentId: departments[2]._id, specialtyId: specialties[5]._id, phone: '+35612345003' },
    { email: 'dr.garcia@hospital.com', password: 'Doctor123!', firstName: 'Maria', lastName: 'Garcia', role: UserRole.DOCTOR, departmentId: departments[3]._id, specialtyId: specialties[6]._id, phone: '+35612345004' },
    { email: 'dr.brown@hospital.com', password: 'Doctor123!', firstName: 'Emma', lastName: 'Brown', role: UserRole.DOCTOR, departmentId: departments[4]._id, specialtyId: specialties[8]._id, phone: '+35612345005' },
  ]);

  await User.create([
    { email: 'reception@hospital.com', password: 'Reception123!', firstName: 'Anna', lastName: 'Borg', role: UserRole.RECEPTIONIST, phone: '+35612345010' },
    { email: 'nurse@hospital.com', password: 'Nurse123!', firstName: 'Lisa', lastName: 'Vella', role: UserRole.NURSE, departmentId: departments[0]._id, phone: '+35612345011' },
    { email: 'analyst@hospital.com', password: 'Analyst123!', firstName: 'Mark', lastName: 'Camilleri', role: UserRole.DATA_ANALYST, phone: '+35612345012' },
    { email: 'manager@hospital.com', password: 'Manager123!', firstName: 'David', lastName: 'Farrugia', role: UserRole.MANAGER, phone: '+35612345013' },
  ]);
  console.log('Created staff users');

  // 4. Create Patient Users
  const patientData = [
    { email: 'john.doe@email.com', firstName: 'John', lastName: 'Doe', dob: '1985-03-15', gender: 'male' as const, noShows: 0, total: 5, attended: 5 },
    { email: 'jane.smith@email.com', firstName: 'Jane', lastName: 'Smith', dob: '1992-07-22', gender: 'female' as const, noShows: 3, total: 8, attended: 4 },
    { email: 'mike.ross@email.com', firstName: 'Mike', lastName: 'Ross', dob: '1978-11-30', gender: 'male' as const, noShows: 5, total: 10, attended: 3 },
    { email: 'sara.connor@email.com', firstName: 'Sara', lastName: 'Connor', dob: '1990-01-10', gender: 'female' as const, noShows: 1, total: 12, attended: 10 },
    { email: 'alex.young@email.com', firstName: 'Alex', lastName: 'Young', dob: '2000-06-05', gender: 'male' as const, noShows: 2, total: 4, attended: 1 },
    { email: 'maria.garcia@email.com', firstName: 'Maria', lastName: 'Garcia', dob: '1988-09-18', gender: 'female' as const, noShows: 0, total: 3, attended: 3 },
    { email: 'tom.lee@email.com', firstName: 'Tom', lastName: 'Lee', dob: '1975-12-01', gender: 'male' as const, noShows: 4, total: 6, attended: 1 },
    { email: 'nina.patel@email.com', firstName: 'Nina', lastName: 'Patel', dob: '1995-04-25', gender: 'female' as const, noShows: 0, total: 7, attended: 7 },
  ];

  const patients = [];
  for (const pd of patientData) {
    const user = await User.create({
      email: pd.email, password: 'Patient123!', firstName: pd.firstName, lastName: pd.lastName,
      role: UserRole.PATIENT, phone: `+3567${Math.floor(1000000 + Math.random() * 9000000)}`,
    });
    const patient = await Patient.create({
      userId: user._id,
      dateOfBirth: new Date(pd.dob),
      gender: pd.gender,
      address: { street: `${Math.floor(1 + Math.random() * 100)} Main St`, city: 'Valletta', state: '', zipCode: 'VLT1000', country: 'Malta' },
      communicationPreference: 'both',
      noShowCount: pd.noShows,
      totalAppointments: pd.total,
      attendedAppointments: pd.attended,
      cancelledAppointments: pd.total - pd.attended - pd.noShows,
    });
    patients.push(patient);
  }
  console.log(`Created ${patients.length} patients`);

  // 5. Create sample appointments (past + upcoming)
  const statuses = [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED];
  const apptRecords = [];

  // Past appointments (for ML training data)
  for (let dayOffset = -60; dayOffset < 0; dayOffset++) {
    const numAppts = Math.floor(3 + Math.random() * 5);
    for (let j = 0; j < numAppts; j++) {
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const hour = 8 + Math.floor(Math.random() * 8);
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      // Bias: high no-show patients get more no-shows
      const patientData2 = patientData.find((p) => p.email.includes(patient.userId.toString().slice(-4))) || patientData[0];
      let finalStatus = status;
      if (patient.noShowCount > 3 && Math.random() < 0.5) finalStatus = AppointmentStatus.NO_SHOW;

      apptRecords.push({
        patientId: patient._id, doctorId: doctor._id,
        departmentId: doctor.departmentId, date,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${hour.toString().padStart(2, '0')}:30`,
        duration: 30, type: AppointmentType.REGULAR,
        status: finalStatus, bookedBy: admin._id, bookingSource: 'receptionist' as const,
        riskScore: Math.random() * 0.8 + 0.1,
        riskLevel: Math.random() > 0.7 ? 'high' as const : Math.random() > 0.4 ? 'medium' as const : 'low' as const,
        predictionTimestamp: date,
      });
    }
  }

  // Future appointments
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const numAppts = Math.floor(2 + Math.random() * 4);
    for (let j = 0; j < numAppts; j++) {
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const doctor = doctors[Math.floor(Math.random() * doctors.length)];
      const hour = 8 + Math.floor(Math.random() * 8);
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);

      const riskScore = patient.noShowCount > 3 ? 0.6 + Math.random() * 0.3 : Math.random() * 0.5;
      const riskLevel = riskScore > 0.6 ? 'high' as const : riskScore > 0.3 ? 'medium' as const : 'low' as const;

      apptRecords.push({
        patientId: patient._id, doctorId: doctor._id,
        departmentId: doctor.departmentId, date,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${hour.toString().padStart(2, '0')}:30`,
        duration: 30, type: AppointmentType.REGULAR,
        status: AppointmentStatus.SCHEDULED, bookedBy: admin._id, bookingSource: 'online' as const,
        riskScore, riskLevel,
        confirmationRequired: riskLevel === 'high',
        predictionTimestamp: new Date(),
      });
    }
  }

  await Appointment.insertMany(apptRecords);
  console.log(`Created ${apptRecords.length} appointments (${apptRecords.filter((a) => a.status === 'no_show').length} no-shows)`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('Demo accounts:');
  console.log('  Admin:        admin@hospital.com / Admin123!');
  console.log('  Doctor:       dr.smith@hospital.com / Doctor123!');
  console.log('  Receptionist: reception@hospital.com / Reception123!');
  console.log('  Nurse:        nurse@hospital.com / Nurse123!');
  console.log('  Analyst:      analyst@hospital.com / Analyst123!');
  console.log('  Manager:      manager@hospital.com / Manager123!');
  console.log('  Patient:      john.doe@email.com / Patient123!');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });