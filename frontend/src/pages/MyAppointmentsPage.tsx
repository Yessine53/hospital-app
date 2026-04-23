import React, { useEffect, useState } from 'react';
import { appointmentApi } from '../services/api';
import { Calendar, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Appointment } from '../types';

const MyAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await appointmentApi.getAll({ limit: '100' });
      setAppointments(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, []);

  const now = new Date();
  const upcoming = appointments.filter((a) =>
    new Date(a.date) >= now && !['completed', 'cancelled', 'no_show'].includes(a.status)
  );
  const past = appointments.filter((a) =>
    new Date(a.date) < now || ['completed', 'cancelled', 'no_show'].includes(a.status)
  );

  const handleConfirm = async (id: string) => {
    try {
      await appointmentApi.confirm(id);
      toast.success('Appointment confirmed!');
      fetchAppointments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Confirmation failed');
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await appointmentApi.cancel(id, 'Patient requested cancellation');
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (err: any) {
      toast.error('Cancellation failed');
    }
  };

  const displayList = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
        <Link to="/book" className="btn-primary text-sm">Book New</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-lg p-1">
        <button
          onClick={() => setTab('upcoming')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all
            ${tab === 'upcoming' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all
            ${tab === 'past' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
        >
          Past ({past.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {tab} appointments</p>
          {tab === 'upcoming' && (
            <Link to="/book" className="text-primary-600 text-sm mt-2 inline-block">Book one now</Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((appt) => (
            <div key={appt._id} className={`card p-5 ${appt.status === 'pending_confirmation' ? 'ring-2 ring-amber-300' : ''}`}>
              {appt.status === 'pending_confirmation' && (
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-amber-50 rounded-lg text-sm text-amber-700">
                  <AlertTriangle size={16} />
                  <span className="font-medium">Confirmation required — please confirm to keep your appointment</span>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">
                    {new Date(appt.date).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-500">
                    <Clock size={14} className="inline mr-1" />
                    {appt.startTime} - {appt.endTime} ({appt.duration} min)
                  </p>
                  <p className="text-sm text-gray-600">
                    Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName} — {appt.departmentId?.name}
                  </p>
                  {appt.reason && <p className="text-sm text-gray-400 italic">{appt.reason}</p>}
                </div>

                <span className={`badge badge-${appt.status}`}>
                  {appt.status.replace(/_/g, ' ')}
                </span>
              </div>

              {tab === 'upcoming' && (
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  {(appt.status === 'scheduled' || appt.status === 'pending_confirmation') && (
                    <button onClick={() => handleConfirm(appt._id)} className="btn-success text-xs gap-1">
                      <CheckCircle size={14} /> Confirm Attendance
                    </button>
                  )}
                  {!['cancelled', 'completed', 'no_show', 'reallocated'].includes(appt.status) && (
                    <button onClick={() => handleCancel(appt._id)} className="btn-secondary text-xs text-red-600 hover:bg-red-50">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyAppointmentsPage;
