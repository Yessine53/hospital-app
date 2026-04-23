import { CronJob } from 'cron';
import Appointment, { AppointmentStatus } from '../models/Appointment';
import Patient from '../models/Patient';
import Reminder, { ReminderType, ReminderChannel, ReminderStatus } from '../models/Reminder';
import { logger } from '../utils/logger';
import axios from 'axios';

// Run daily at 6 AM - check appointments 2 days out for high risk
export const noShowCheckJob = new CronJob('0 6 * * *', async () => {
  logger.info('Running no-show check job...');

  try {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const startOfDay = new Date(twoDaysFromNow.setHours(0, 0, 0, 0));
    const endOfDay = new Date(twoDaysFromNow.setHours(23, 59, 59, 999));

    // Find appointments 2 days from now that need checking
    const appointments = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: AppointmentStatus.SCHEDULED,
      confirmationRequired: true,
      confirmedAt: null,
    }).populate('patientId');

    logger.info(`Found ${appointments.length} high-risk appointments to process`);

    for (const appt of appointments) {
      // Set status to pending confirmation
      appt.status = AppointmentStatus.PENDING_CONFIRMATION;
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);
      appt.confirmationDeadline = deadline;
      await appt.save();

      // Create reminder records
      const patient = await Patient.findById(appt.patientId).populate('userId');
      if (!patient) continue;

      const messageContent = `Your appointment on ${appt.date.toDateString()} at ${appt.startTime} requires confirmation. Please log in to confirm within 24 hours or your slot may be reassigned.`;

      if (patient.communicationPreference === 'email' || patient.communicationPreference === 'both') {
        await Reminder.create({
          appointmentId: appt._id,
          patientId: patient._id,
          type: ReminderType.CONFIRMATION_REQUEST,
          channel: ReminderChannel.EMAIL,
          status: ReminderStatus.PENDING,
          scheduledFor: new Date(),
          messageContent,
        });
      }

      if (patient.communicationPreference === 'sms' || patient.communicationPreference === 'both') {
        await Reminder.create({
          appointmentId: appt._id,
          patientId: patient._id,
          type: ReminderType.CONFIRMATION_REQUEST,
          channel: ReminderChannel.SMS,
          status: ReminderStatus.PENDING,
          scheduledFor: new Date(),
          messageContent,
        });
      }
    }
  } catch (error) {
    logger.error('No-show check job error:', error);
  }
});

// Run every hour - check for expired confirmation deadlines
export const reallocationJob = new CronJob('0 * * * *', async () => {
  logger.info('Running reallocation check...');

  try {
    const now = new Date();

    // Find appointments past their confirmation deadline that weren't confirmed
    const expiredAppointments = await Appointment.find({
      status: AppointmentStatus.PENDING_CONFIRMATION,
      confirmationDeadline: { $lte: now },
      confirmedAt: null,
    });

    logger.info(`Found ${expiredAppointments.length} expired confirmations to reallocate`);

    for (const appt of expiredAppointments) {
      // Mark as reallocated
      appt.status = AppointmentStatus.REALLOCATED;
      await appt.save();

      // Find next-day patients who could fill this slot
      const nextDay = new Date(appt.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStart = new Date(nextDay.setHours(0, 0, 0, 0));
      const nextDayEnd = new Date(nextDay.setHours(23, 59, 59, 999));

      const nextDayAppointments = await Appointment.find({
        departmentId: appt.departmentId,
        date: { $gte: nextDayStart, $lte: nextDayEnd },
        status: { $in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      })
        .populate('patientId')
        .sort({ createdAt: 1 })
        .limit(3);

      // Offer the slot to next-day patients
      for (const nextAppt of nextDayAppointments) {
        const patient = await Patient.findById(nextAppt.patientId).populate('userId');
        if (!patient) continue;

        const offerMessage = `An earlier appointment slot has opened on ${appt.date.toDateString()} at ${appt.startTime}. Log in to confirm if you'd like to move to this earlier time.`;

        await Reminder.create({
          appointmentId: nextAppt._id,
          patientId: patient._id,
          type: ReminderType.REALLOCATION_OFFER,
          channel: ReminderChannel.EMAIL,
          status: ReminderStatus.PENDING,
          scheduledFor: new Date(),
          messageContent: offerMessage,
        });
      }

      // Notify original patient that their appointment was moved
      const originalPatient = await Patient.findById(appt.patientId).populate('userId');
      if (originalPatient) {
        await Reminder.create({
          appointmentId: appt._id,
          patientId: originalPatient._id,
          type: ReminderType.APPOINTMENT_MOVED,
          channel: ReminderChannel.EMAIL,
          status: ReminderStatus.PENDING,
          scheduledFor: new Date(),
          messageContent: `Your appointment on ${appt.date.toDateString()} at ${appt.startTime} has been rescheduled as we didn't receive your confirmation. Please log in to book a new appointment.`,
        });
      }
    }
  } catch (error) {
    logger.error('Reallocation job error:', error);
  }
});

export const startCronJobs = (): void => {
  noShowCheckJob.start();
  reallocationJob.start();
  logger.info('Cron jobs started: no-show check (daily 6AM), reallocation check (hourly)');
};
