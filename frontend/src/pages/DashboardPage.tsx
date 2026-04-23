import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentApi, reportApi } from '../services/api';
import {
  Calendar, Users, AlertTriangle, CheckCircle, XCircle, Clock,
  TrendingUp, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardStats, Appointment } from '../types';

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ label, value, icon, color, subtitle }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, apptRes] = await Promise.all([
          appointmentApi.getDashboard(),
          appointmentApi.getAll({
            date: new Date().toISOString().split('T')[0],
            limit: '10',
          }),
        ]);
        setStats(dashRes.data.data);
        setTodayAppointments(apptRes.data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const cls = `badge badge-${status}`;
    const labels: Record<string, string> = {
      scheduled: 'Scheduled', confirmed: 'Confirmed', pending_confirmation: 'Pending',
      checked_in: 'Checked In', in_progress: 'In Progress', completed: 'Completed',
      cancelled: 'Cancelled', no_show: 'No Show', reallocated: 'Reallocated',
    };
    return <span className={cls}>{labels[status] || status}</span>;
  };

  const riskBadge = (level?: string) => {
    if (!level) return null;
    return <span className={`badge badge-${level}`}>{level}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'},{' '}
          {user?.role === 'doctor' ? 'Dr. ' : ''}{user?.firstName}
        </h1>
        <p className="text-gray-500 mt-1">
          Here's your overview for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Appointments"
          value={stats?.today.total || 0}
          icon={<Calendar size={20} className="text-white" />}
          color="bg-primary-500"
          subtitle={`${stats?.today.pending || 0} pending`}
        />
        <StatCard
          label="Completed Today"
          value={stats?.today.completed || 0}
          icon={<CheckCircle size={20} className="text-white" />}
          color="bg-emerald-500"
        />
        <StatCard
          label="No-Shows Today"
          value={stats?.today.noShows || 0}
          icon={<XCircle size={20} className="text-white" />}
          color="bg-red-500"
        />
        <StatCard
          label="High-Risk Upcoming"
          value={stats?.highRiskUpcoming || 0}
          icon={<AlertTriangle size={20} className="text-white" />}
          color="bg-amber-500"
          subtitle="Needs attention"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="This Week"
          value={stats?.weekTotal || 0}
          icon={<TrendingUp size={20} className="text-white" />}
          color="bg-indigo-500"
          subtitle="Total appointments"
        />
        <StatCard
          label="Total Patients"
          value={stats?.totalPatients || 0}
          icon={<Users size={20} className="text-white" />}
          color="bg-cyan-500"
          subtitle="Registered"
        />
        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Quick Actions</p>
            <div className="flex gap-2 mt-3">
              <Link to="/book" className="btn-primary text-xs px-3 py-1.5">New Booking</Link>
              <Link to="/walk-in" className="btn-secondary text-xs px-3 py-1.5">Walk-In</Link>
            </div>
          </div>
          <Clock size={32} className="text-gray-300" />
        </div>
      </div>

      {/* Today's Appointments Table */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Today's Appointments</h3>
          <Link to="/appointments" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-40" />
            <p>No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="table-header">Time</th>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayAppointments.map((appt) => (
                  <tr key={appt._id} className="hover:bg-surface-50 transition-colors">
                    <td className="table-cell font-medium">{appt.startTime}</td>
                    <td className="table-cell">
                      {appt.patientId?.userId?.firstName} {appt.patientId?.userId?.lastName}
                    </td>
                    <td className="table-cell">
                      Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}
                    </td>
                    <td className="table-cell">{appt.departmentId?.name}</td>
                    <td className="table-cell capitalize">{appt.type.replace('_', ' ')}</td>
                    <td className="table-cell">{statusBadge(appt.status)}</td>
                    <td className="table-cell">{riskBadge(appt.riskLevel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
