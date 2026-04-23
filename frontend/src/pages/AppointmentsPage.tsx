import React, { useEffect, useState } from 'react';
import { appointmentApi } from '../services/api';
import { Link } from 'react-router-dom';
import { Calendar, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Appointment, Pagination } from '../types';
import toast from 'react-hot-toast';

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', date: '', riskLevel: '' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchAppointments = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;
      if (filters.riskLevel) params.riskLevel = filters.riskLevel;

      const res = await appointmentApi.getAll(params);
      setAppointments(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, [filters]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await appointmentApi.update(id, { status });
      toast.success(`Appointment ${status}`);
      fetchAppointments(pagination.page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const statusBadge = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Scheduled', confirmed: 'Confirmed', pending_confirmation: 'Pending Confirm',
      checked_in: 'Checked In', in_progress: 'In Progress', completed: 'Completed',
      cancelled: 'Cancelled', no_show: 'No Show', reallocated: 'Reallocated',
    };
    return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500">{pagination.total} total appointments</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary gap-2">
            <Filter size={16} /> Filters
          </button>
          <Link to="/book" className="btn-primary gap-2">
            <Plus size={16} /> New Appointment
          </Link>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input-field py-2"
            >
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_confirmation">Pending Confirmation</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="input-field py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Risk Level</label>
            <select
              value={filters.riskLevel}
              onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
              className="input-field py-2"
            >
              <option value="">All risks</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', date: '', riskLevel: '' })}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No appointments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="table-header">Date & Time</th>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Risk</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appt) => (
                  <tr key={appt._id} className="hover:bg-surface-50 transition-colors">
                    <td className="table-cell">
                      <div className="font-medium">{new Date(appt.date).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{appt.startTime} - {appt.endTime}</div>
                    </td>
                    <td className="table-cell">
                      {appt.patientId?.userId?.firstName} {appt.patientId?.userId?.lastName}
                    </td>
                    <td className="table-cell">
                      Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}
                    </td>
                    <td className="table-cell">{appt.departmentId?.name}</td>
                    <td className="table-cell capitalize">{appt.type.replace('_', ' ')}</td>
                    <td className="table-cell">{statusBadge(appt.status)}</td>
                    <td className="table-cell">
                      {appt.riskLevel && (
                        <div>
                          <span className={`badge badge-${appt.riskLevel}`}>{appt.riskLevel}</span>
                          {appt.riskScore !== undefined && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {(appt.riskScore * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {appt.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(appt._id, 'checked_in')}
                              className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                            >
                              Check In
                            </button>
                            <button
                              onClick={() => handleStatusChange(appt._id, 'no_show')}
                              className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                            >
                              No Show
                            </button>
                          </>
                        )}
                        {appt.status === 'checked_in' && (
                          <button
                            onClick={() => handleStatusChange(appt._id, 'completed')}
                            className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchAppointments(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => fetchAppointments(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentsPage;
