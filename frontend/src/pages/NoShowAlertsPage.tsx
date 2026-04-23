import React, { useEffect, useState } from 'react';
import { appointmentApi } from '../services/api';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Appointment } from '../types';

const NoShowAlertsPage: React.FC = () => {
  const [highRisk, setHighRisk] = useState<Appointment[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const [hrRes, pcRes] = await Promise.all([
        appointmentApi.getAll({ riskLevel: 'high', status: 'scheduled', limit: '50' }),
        appointmentApi.getAll({ status: 'pending_confirmation', limit: '50' }),
      ]);
      setHighRisk(hrRes.data.data);
      setPendingConfirm(pcRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const handleAction = async (id: string, action: 'confirm' | 'cancel') => {
    try {
      if (action === 'confirm') {
        await appointmentApi.confirm(id);
        toast.success('Appointment confirmed');
      } else {
        await appointmentApi.cancel(id, 'No-show risk — patient did not confirm');
        toast.success('Appointment cancelled');
      }
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">No-Show Risk Alerts</h1>
        <p className="text-sm text-gray-500">Monitor and manage high-risk appointments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{highRisk.length}</p>
            <p className="text-xs text-gray-500">High-risk upcoming</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{pendingConfirm.length}</p>
            <p className="text-xs text-gray-500">Awaiting confirmation</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4 border-l-4 border-l-blue-400">
          <div>
            <p className="text-sm text-gray-600">
              Patients flagged as high-risk are notified 2 days before their appointment and have 24 hours to confirm via the web app.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Confirmations */}
      {pendingConfirm.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              Awaiting Patient Confirmation ({pendingConfirm.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingConfirm.map((appt) => (
              <div key={appt._id} className="p-4 flex items-center gap-4 bg-amber-50/30">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {appt.patientId?.userId?.firstName} {appt.patientId?.userId?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(appt.date).toLocaleDateString()} at {appt.startTime} — Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}
                  </p>
                  {appt.confirmationDeadline && (
                    <p className="text-xs text-red-500 mt-1">
                      Deadline: {new Date(appt.confirmationDeadline).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-600">{((appt.riskScore || 0) * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-gray-400">Risk Score</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(appt._id, 'confirm')}
                    className="btn-success text-xs gap-1 px-3 py-1.5"
                  >
                    <CheckCircle size={14} /> Confirm
                  </button>
                  <button
                    onClick={() => handleAction(appt._id, 'cancel')}
                    className="btn-danger text-xs gap-1 px-3 py-1.5"
                  >
                    <XCircle size={14} /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High-Risk Upcoming */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            High-Risk Upcoming Appointments ({highRisk.length})
          </h3>
        </div>
        {highRisk.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
            <p>No high-risk appointments at this time</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="table-header">Patient</th>
                  <th className="table-header">Date & Time</th>
                  <th className="table-header">Doctor</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Risk Score</th>
                  <th className="table-header">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {highRisk.map((appt) => (
                  <tr key={appt._id} className="hover:bg-red-50/30">
                    <td className="table-cell font-medium">
                      {appt.patientId?.userId?.firstName} {appt.patientId?.userId?.lastName}
                    </td>
                    <td className="table-cell">
                      {new Date(appt.date).toLocaleDateString()} at {appt.startTime}
                    </td>
                    <td className="table-cell">
                      Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}
                    </td>
                    <td className="table-cell">{appt.departmentId?.name}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: `${(appt.riskScore || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-red-600">
                          {((appt.riskScore || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {appt.patientId?.noShowCount || 0} no-shows / {appt.patientId?.totalAppointments || 0} total
                    </td>
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

export default NoShowAlertsPage;
