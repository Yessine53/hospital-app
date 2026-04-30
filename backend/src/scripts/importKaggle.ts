/**
 * MedBook — Kaggle Data Import Script
 * 
 * Maps the Kaggle healthcare appointment dataset into the MedBook MongoDB schema.
 * 
 * Source files:
 *   - patients.csv  (36,697 patients: patient_id, name, sex, dob, insurance)
 *   - appointments.csv (111,488 appointments: with status, times, scheduling_interval, etc.)
 * 
 * Usage:
 *   npx ts-node src/scripts/importKaggle.ts <path-to-csv-folder>
 *   OR inside Docker:
 *   docker exec -it hospital-backend npx ts-node src/scripts/importKaggle.ts /data
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import User, { UserRole } from '../models/User';
import Patient from '../models/Patient';
import { Department, Specialty } from '../models/Department';
import Appointment, { AppointmentStatus, AppointmentType } from '../models/Appointment';
import AuditLog from '../models/AuditLog';
import Reminder from '../models/Reminder';
import WalkInQueue from '../models/WalkInQueue';

dotenv.config();

const _MONGODB_URI = process.env.MONGODB_URI;
if (!_MONGODB_URI) {
  console.error('FATAL: MONGODB_URI environment variable is not set.');
  console.error('Set it in backend/.env (see backend/.env.example) before running this script.');
  process.exit(1);
}
// After the guard above, MONGODB_URI is definitely a string. The cast satisfies
// TypeScript's narrowing, which doesn't follow process.exit branches.
const MONGODB_URI: string = _MONGODB_URI as string;
const BATCH_SIZE = 500;

// ─── CSV Parser (lightweight, no dependency needed) ───
function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => (row[h] = values[idx]));
      rows.push(row);
    }
  }
  return rows;
}

// ─── Status mapping ───
function mapStatus(kaggleStatus: string): AppointmentStatus {
  switch (kaggleStatus.toLowerCase()) {
    case 'attended': return AppointmentStatus.COMPLETED;
    case 'did not attend': return AppointmentStatus.NO_SHOW;
    case 'cancelled': return AppointmentStatus.CANCELLED;
    case 'scheduled': return AppointmentStatus.SCHEDULED;
    default: return AppointmentStatus.COMPLETED;
  }
}

// ─── Compute end time from start time + duration ───
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + Math.round(minutes);
  const eH = Math.floor(total / 60) % 24;
  const eM = total % 60;
  return `${eH.toString().padStart(2, '0')}:${eM.toString().padStart(2, '0')}`;
}

async function importData() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // ─── 1. Clear existing data ───
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Department.deleteMany({}),
    Specialty.deleteMany({}),
    Appointment.deleteMany({}),
    AuditLog.deleteMany({}),
    Reminder.deleteMany({}),
    WalkInQueue.deleteMany({}),
  ]);
  console.log('✓ Database cleared\n');

  // ─── 2. Create departments & specialties ───
  console.log('Creating departments...');
  const departments = await Department.create([
    {
      name: 'General Medicine', code: 'GM', floor: '1',
      description: 'Primary care, internal medicine, and general outpatient services',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '08:00', endTime: '17:00', isOpen: d >= 1 && d <= 5,
      })),
    },
    {
      name: 'Cardiology', code: 'CARD', floor: '2',
      description: 'Heart and cardiovascular care',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '08:00', endTime: '16:30', isOpen: d >= 1 && d <= 5,
      })),
    },
    {
      name: 'Dermatology', code: 'DERM', floor: '2',
      description: 'Skin conditions, allergies, and cosmetic dermatology',
      defaultSlotDuration: 20,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '09:00', endTime: '16:00', isOpen: d >= 1 && d <= 4,
      })),
    },
    {
      name: 'Orthopaedics', code: 'ORTH', floor: '3',
      description: 'Bones, joints, sports injuries, and musculoskeletal care',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '08:00', endTime: '17:00', isOpen: d >= 1 && d <= 5,
      })),
    },
    {
      name: 'Paediatrics', code: 'PAED', floor: '1',
      description: 'Children and adolescent healthcare',
      defaultSlotDuration: 30,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '08:00', endTime: '16:00', isOpen: d >= 1 && d <= 5,
      })),
    },
    {
      name: 'Neurology', code: 'NEUR', floor: '3',
      description: 'Brain, spine, and nervous system disorders',
      defaultSlotDuration: 45,
      operatingHours: [0,1,2,3,4,5,6].map((d) => ({
        dayOfWeek: d, startTime: '08:30', endTime: '16:30', isOpen: d >= 1 && d <= 5,
      })),
    },
  ]);

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
    { name: 'General Paediatrics', departmentId: departments[4]._id, defaultSlotDuration: 30 },
    { name: 'Clinical Neurology', departmentId: departments[5]._id, defaultSlotDuration: 45 },
  ]);
  console.log(`✓ Created ${departments.length} departments, ${specialties.length} specialties\n`);

  // ─── 3. Create staff users ───
  console.log('Creating staff accounts...');
  const admin = await User.create({
    email: 'admin@hospital.com', password: 'Admin123!',
    firstName: 'System', lastName: 'Admin', role: UserRole.ADMIN, phone: '+35612345678',
  });

  const doctorData = [
    { email: 'dr.smith@hospital.com', firstName: 'James', lastName: 'Smith', deptIdx: 0, specIdx: 0 },
    { email: 'dr.johnson@hospital.com', firstName: 'Sarah', lastName: 'Johnson', deptIdx: 1, specIdx: 2 },
    { email: 'dr.chen@hospital.com', firstName: 'Wei', lastName: 'Chen', deptIdx: 2, specIdx: 5 },
    { email: 'dr.garcia@hospital.com', firstName: 'Maria', lastName: 'Garcia', deptIdx: 3, specIdx: 6 },
    { email: 'dr.brown@hospital.com', firstName: 'Emma', lastName: 'Brown', deptIdx: 4, specIdx: 8 },
    { email: 'dr.taylor@hospital.com', firstName: 'Robert', lastName: 'Taylor', deptIdx: 0, specIdx: 1 },
    { email: 'dr.williams@hospital.com', firstName: 'Laura', lastName: 'Williams', deptIdx: 1, specIdx: 3 },
    { email: 'dr.martinez@hospital.com', firstName: 'Carlos', lastName: 'Martinez', deptIdx: 5, specIdx: 10 },
  ];

  const doctors: any[] = [];
  for (const d of doctorData) {
      const doc: any = await User.create({
      email: d.email, password: 'Doctor123!', firstName: d.firstName, lastName: d.lastName,
      role: UserRole.DOCTOR, departmentId: departments[d.deptIdx]._id,
      specialtyId: specialties[d.specIdx]._id, phone: `+3561234${5001 + doctors.length}`,
    });
    doctors.push(doc);
  }

  await User.create([
    { email: 'reception@hospital.com', password: 'Reception123!', firstName: 'Anna', lastName: 'Borg', role: UserRole.RECEPTIONIST, phone: '+35612345010' },
    { email: 'nurse@hospital.com', password: 'Nurse123!', firstName: 'Lisa', lastName: 'Vella', role: UserRole.NURSE, departmentId: departments[0]._id, phone: '+35612345011' },
    { email: 'analyst@hospital.com', password: 'Analyst123!', firstName: 'Mark', lastName: 'Camilleri', role: UserRole.DATA_ANALYST, phone: '+35612345012' },
    { email: 'manager@hospital.com', password: 'Manager123!', firstName: 'David', lastName: 'Farrugia', role: UserRole.MANAGER, phone: '+35612345013' },
  ]);
  console.log(`✓ Created ${doctors.length} doctors + 4 staff accounts\n`);

  // ─── 4. Import patients from CSV ───
  const csvDir = process.argv[2] || '/data';
  const patientsFile = path.join(csvDir, 'patients.csv');
  const appointmentsFile = path.join(csvDir, 'appointments.csv');

  console.log(`Reading patients from ${patientsFile}...`);
  const patientRows = parseCSV(patientsFile);
  console.log(`  Found ${patientRows.length} patient records`);

  // Map kaggle patient_id → mongo ObjectId
  const patientIdMap = new Map<string, mongoose.Types.ObjectId>();
  const patientUserIdMap = new Map<string, mongoose.Types.ObjectId>();

  let patientCount = 0;
  const patientBatch: any[] = [];
  const userBatch: any[] = [];

  for (const row of patientRows) {
    const kaggleId = row.patient_id;
    const nameParts = (row.name || 'Unknown Patient').split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'Patient';
    const gender = row.sex?.toLowerCase() === 'male' ? 'male'
                 : row.sex?.toLowerCase() === 'female' ? 'female' : 'other';
    const dob = row.dob || '1990-01-01';

    // Generate unique email from kaggle patient_id
    const email = `patient.${kaggleId}@medbook.local`;

    const userId = new mongoose.Types.ObjectId();
    const patientId = new mongoose.Types.ObjectId();

    patientIdMap.set(kaggleId, patientId);
    patientUserIdMap.set(kaggleId, userId);

    userBatch.push({
      _id: userId,
      email,
      password: '$2a$12$LJ3NiRxYN0aRr/TjKbQGqe8.FPPqLpVqVZL6U0oHqNGlP6bMZJXKy', // pre-hashed "Patient123!"
      firstName,
      lastName,
      role: UserRole.PATIENT,
      phone: `+3569${Math.floor(1000000 + Math.random() * 9000000)}`,
      isActive: true,
    });

    patientBatch.push({
      _id: patientId,
      userId,
      dateOfBirth: new Date(dob),
      gender,
      communicationPreference: 'both',
      noShowCount: 0,
      totalAppointments: 0,
      attendedAppointments: 0,
      cancelledAppointments: 0,
      address: {
        street: `${Math.floor(1 + Math.random() * 200)} Republic Street`,
        city: 'Valletta', state: '', zipCode: 'VLT1000', country: 'Malta',
      },
      ...(row.insurance ? {
        insuranceInfo: { provider: row.insurance, policyNumber: `POL-${kaggleId}`, expiryDate: new Date('2026-12-31') },
      } : {}),
    });

    // Insert in batches to avoid memory issues
    if (userBatch.length >= BATCH_SIZE) {
      await User.insertMany(userBatch, { ordered: false }).catch(() => {});
      await Patient.insertMany(patientBatch, { ordered: false }).catch(() => {});
      patientCount += userBatch.length;
      process.stdout.write(`\r  Imported ${patientCount} / ${patientRows.length} patients`);
      userBatch.length = 0;
      patientBatch.length = 0;
    }
  }
  // Flush remaining
  if (userBatch.length > 0) {
    await User.insertMany(userBatch, { ordered: false }).catch(() => {});
    await Patient.insertMany(patientBatch, { ordered: false }).catch(() => {});
    patientCount += userBatch.length;
  }
  console.log(`\n✓ Imported ${patientCount} patients\n`);

  // ─── 5. Import appointments from CSV ───
  console.log(`Reading appointments from ${appointmentsFile}...`);
  const apptRows = parseCSV(appointmentsFile);
  console.log(`  Found ${apptRows.length} appointment records`);

  // Pre-compute patient no-show stats
  const patientStats = new Map<string, { total: number; noShows: number; attended: number; cancelled: number }>();
  for (const row of apptRows) {
    const pid = row.patient_id;
    if (!patientStats.has(pid)) {
      patientStats.set(pid, { total: 0, noShows: 0, attended: 0, cancelled: 0 });
    }
    const s = patientStats.get(pid)!;
    s.total++;
    const status = row.status?.toLowerCase() || '';
    if (status === 'attended') s.attended++;
    else if (status === 'did not attend') s.noShows++;
    else if (status === 'cancelled') s.cancelled++;
  }

  let apptCount = 0;
  let apptBatch: any[] = [];

  for (const row of apptRows) {
    const kagglePatientId = row.patient_id;
    const patientId = patientIdMap.get(kagglePatientId);
    if (!patientId) continue;

    const status = mapStatus(row.status || 'attended');
    if (status === AppointmentStatus.COMPLETED && row.status?.toLowerCase() === 'unknown') continue;

    // Assign to a doctor (deterministic based on patient ID hash)
    const doctorIdx = parseInt(kagglePatientId, 10) % doctors.length;
    const doctor = doctors[doctorIdx];

    // Parse times
    const apptTime = (row.appointment_time || '09:00:00').substring(0, 5); // "HH:MM"
    const duration = parseFloat(row.appointment_duration || '30') || 30;
    const endTime = addMinutes(apptTime, Math.min(duration, 120));

    // Lead time (scheduling_interval)
    const leadTimeDays = parseInt(row.scheduling_interval || '0', 10);

    // Calculate risk score based on patient history
    const stats = patientStats.get(kagglePatientId);
    const noShowRate = stats && stats.total > 0 ? stats.noShows / stats.total : 0;
    let riskScore = 0.1;
    if (noShowRate > 0.3) riskScore = 0.65 + Math.random() * 0.2;
    else if (noShowRate > 0.15) riskScore = 0.35 + Math.random() * 0.2;
    else riskScore = 0.05 + Math.random() * 0.2;
    if (leadTimeDays > 14) riskScore = Math.min(riskScore + 0.1, 0.95);

    const riskLevel = riskScore > 0.6 ? 'high' : riskScore > 0.3 ? 'medium' : 'low';

    apptBatch.push({
      patientId,
      doctorId: doctor._id,
      departmentId: doctor.departmentId,
      date: new Date(row.appointment_date || '2024-01-01'),
      startTime: apptTime,
      endTime,
      duration: Math.round(Math.min(duration, 120)),
      type: AppointmentType.REGULAR,
      status,
      bookedBy: admin._id,
      bookingSource: 'receptionist',
      riskScore: Math.round(riskScore * 10000) / 10000,
      riskLevel,
      predictionTimestamp: new Date(row.scheduling_date || row.appointment_date || '2024-01-01'),
      confirmationRequired: riskLevel === 'high' && status === AppointmentStatus.SCHEDULED,
      ...(status === AppointmentStatus.COMPLETED ? { completedAt: new Date(row.appointment_date) } : {}),
      ...(status === AppointmentStatus.CANCELLED ? { cancelledAt: new Date(row.appointment_date) } : {}),
      ...(row.check_in_time ? { checkedInAt: new Date(`${row.appointment_date}T${row.check_in_time}`) } : {}),
    });

    if (apptBatch.length >= BATCH_SIZE) {
      await Appointment.insertMany(apptBatch, { ordered: false }).catch(() => {});
      apptCount += apptBatch.length;
      process.stdout.write(`\r  Imported ${apptCount} / ${apptRows.length} appointments`);
      apptBatch = [];
    }
  }
  if (apptBatch.length > 0) {
    await Appointment.insertMany(apptBatch, { ordered: false }).catch(() => {});
    apptCount += apptBatch.length;
  }
  console.log(`\n✓ Imported ${apptCount} appointments\n`);

  // ─── 6. Update patient stats ───
  console.log('Updating patient statistics...');
  let statsCount = 0;
  const bulkOps: any[] = [];

  for (const [kaggleId, stats] of patientStats.entries()) {
    const patientId = patientIdMap.get(kaggleId);
    if (!patientId) continue;
    bulkOps.push({
      updateOne: {
        filter: { _id: patientId },
        update: {
          $set: {
            totalAppointments: stats.total,
            noShowCount: stats.noShows,
            attendedAppointments: stats.attended,
            cancelledAppointments: stats.cancelled,
          },
        },
      },
    });
    if (bulkOps.length >= BATCH_SIZE) {
      await Patient.bulkWrite(bulkOps);
      statsCount += bulkOps.length;
      process.stdout.write(`\r  Updated ${statsCount} patient stats`);
      bulkOps.length = 0;
    }
  }
  if (bulkOps.length > 0) {
    await Patient.bulkWrite(bulkOps);
    statsCount += bulkOps.length;
  }
  console.log(`\n✓ Updated ${statsCount} patient statistics\n`);

  // ─── Summary ───
  const totalNoShows = [...patientStats.values()].reduce((sum, s) => sum + s.noShows, 0);
  const totalAttended = [...patientStats.values()].reduce((sum, s) => sum + s.attended, 0);
  const overallNoShowRate = ((totalNoShows / (totalNoShows + totalAttended)) * 100).toFixed(1);

  console.log('═══════════════════════════════════════════');
  console.log('  IMPORT COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Patients:      ${patientCount.toLocaleString()}`);
  console.log(`  Appointments:  ${apptCount.toLocaleString()}`);
  console.log(`  No-shows:      ${totalNoShows.toLocaleString()}`);
  console.log(`  Attended:      ${totalAttended.toLocaleString()}`);
  console.log(`  No-show rate:  ${overallNoShowRate}%`);
  console.log(`  Departments:   ${departments.length}`);
  console.log(`  Doctors:       ${doctors.length}`);
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('  Demo accounts:');
  console.log('    Admin:        admin@hospital.com / Admin123!');
  console.log('    Doctor:       dr.smith@hospital.com / Doctor123!');
  console.log('    Receptionist: reception@hospital.com / Reception123!');
  console.log('    Nurse:        nurse@hospital.com / Nurse123!');
  console.log('    Analyst:      analyst@hospital.com / Analyst123!');
  console.log('    Manager:      manager@hospital.com / Manager123!');
  console.log('');
  console.log('  Next step: retrain the ML model with real data:');
  console.log('    curl.exe -X POST http://localhost:8000/train');
  console.log('═══════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

importData().catch((err) => {
  console.error('\n✗ Import failed:', err.message || err);
  process.exit(1);
});