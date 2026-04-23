import React, { useEffect, useState } from 'react';
import { walkInApi, departmentApi, patientApi } from '../services/api';
import { ListOrdered, Phone, UserPlus, ArrowRight, X, Check, Clock, Footprints, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, WalkInEntry, Patient } from '../types';

const WalkInPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [queue, setQueue] = useState<WalkInEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Walk-In modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [addForm, setAddForm] = useState({ patientId: '', reason: '', priority: 'normal' as 'normal' | 'urgent' | 'emergency' });
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    departmentApi.getAll().then((res) => setDepartments(res.data.data));
  }, []);

  useEffect(() => {
    if (selectedDept) fetchQueue();
  }, [selectedDept]);

  // Search patients for the add modal
  useEffect(() => {
    if (showAddModal) {
      const t = setTimeout(() => {
        patientApi.getAll({ limit: '20', search: patientSearch || undefined })
          .then(res => setPatients(res.data.data));
      }, 300);
      return () => clearTimeout(t);
    }
  }, [showAddModal, patientSearch]);

  const fetchQueue = async () => {
    if (!selectedDept) return;
    setLoading(true);
    try {
      const res = await walkInApi.getQueue(selectedDept);
      setQueue(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = async () => {
    try {
      const res = await walkInApi.callNext(selectedDept);
      toast.success(res.data.message);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No patients waiting');
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await walkInApi.updateStatus(id, status);
      toast.success('Status updated');
      fetchQueue();
    } catch (err: any) {
      toast.error('Update failed');
    }
  };

  const handleAddWalkIn = async () => {
    if (!addForm.patientId) {
      toast.error('Please select a patient');
      return;
    }
    if (!addForm.reason.trim()) {
      toast.error('Please enter a reason for the visit');
      return;
    }
    if (!selectedDept) {
      toast.error('Please select a department first');
      return;
    }
    setAddSaving(true);
    try {
      const res = await walkInApi.addToQueue({
        patientId: addForm.patientId,
        departmentId: selectedDept,
        reason: addForm.reason,
        priority: addForm.priority,
      });
      toast.success(res.data.message);
      setShowAddModal(false);
      setAddForm({ patientId: '', reason: '', priority: 'normal' });
      fetchQueue();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add to queue');
    } finally {
      setAddSaving(false);
    }
  };

  const priorityColors: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-700',
    urgent: 'bg-amber-100 text-amber-800',
    emergency: 'bg-red-100 text-red-800',
  };

  const statusColors: Record<string, string> = {
    waiting: 'bg-blue-50 text-blue-700',
    called: 'bg-amber-50 text-amber-700',
    in_progress: 'bg-violet-50 text-violet-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
    skipped: 'bg-gray-100 text-gray-500',
  };

  const waitingCount = queue.filter((q) => q.status === 'waiting').length;
  const inProgressCount = queue.filter((q) => q.status === 'in_progress' || q.status === 'called').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Walk-In Queue</h1>
          <p className="text-sm text-gray-500">Manage walk-in patients by department</p>
        </div>
      </div>

      {/* How it works info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-3">
        <Footprints size={20} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">Walk-In vs Scheduled Appointments</p>
          <p className="text-blue-700">
            Walk-in patients are registered here and added to a department queue. They receive a queue number and wait to be called.
            Scheduled appointments are booked in advance via the <span className="font-medium">Book Appointment</span> page.
            Both types appear in the Appointments list, where you can distinguish them by the <span className="font-mono text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">walk in</span> badge in the Type column.
          </p>
        </div>
      </div>

      {/* Department selector */}
      <div className="flex gap-3 flex-wrap">
        {departments.map((d) => (
          <button
            key={d._id}
            onClick={() => setSelectedDept(d._id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${selectedDept === d._id
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'}`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {selectedDept && (
        <>
          {/* Stats + Actions */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <ListOrdered size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{waitingCount}</p>
                <p className="text-xs text-gray-500">Waiting</p>
              </div>
            </div>
            <div className="card px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                <Phone size={16} className="text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{inProgressCount}</p>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
            </div>

            <div className="flex-1" />

            <button onClick={() => setShowAddModal(true)} className="btn-success gap-2">
              <UserPlus size={16} /> Add Walk-In
            </button>
            <button onClick={handleCallNext} className="btn-primary gap-2">
              <ArrowRight size={16} /> Call Next Patient
            </button>
          </div>

          {/* Queue list */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : queue.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <ListOrdered size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No patients in queue</p>
                <p className="text-xs mt-1">Click "Add Walk-In" to register a walk-in patient</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {queue.map((entry) => (
                  <div key={entry._id} className={`p-4 flex items-center gap-4 ${entry.status === 'called' ? 'bg-amber-50' : ''}`}>
                    {/* Queue number */}
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <span className="text-lg font-bold text-primary-700">{entry.queueNumber}</span>
                    </div>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {entry.patientId?.userId?.firstName} {entry.patientId?.userId?.lastName}
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-medium rounded-full ring-1 ring-inset ring-cyan-600/20">
                          <Footprints size={10} /> Walk-In
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{entry.reason}</p>
                    </div>

                    {/* Priority */}
                    <span className={`badge ${priorityColors[entry.priority] || priorityColors.normal}`}>
                      {entry.priority}
                    </span>

                    {/* Status */}
                    <span className={`badge ${statusColors[entry.status] || statusColors.waiting}`}>
                      {entry.status.replace('_', ' ')}
                    </span>

                    {/* Wait time */}
                    {entry.estimatedWaitMinutes !== undefined && entry.status === 'waiting' && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={12} /> ~{entry.estimatedWaitMinutes}min
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1">
                      {entry.status === 'called' && (
                        <button
                          onClick={() => handleStatusUpdate(entry._id, 'in_progress')}
                          className="text-xs px-2 py-1 bg-violet-50 text-violet-700 rounded hover:bg-violet-100"
                        >
                          Start
                        </button>
                      )}
                      {entry.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusUpdate(entry._id, 'completed')}
                          className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"
                        >
                          Complete
                        </button>
                      )}
                      {(entry.status === 'waiting' || entry.status === 'called') && (
                        <button
                          onClick={() => handleStatusUpdate(entry._id, 'skipped')}
                          className="text-xs px-2 py-1 bg-gray-50 text-gray-500 rounded hover:bg-gray-100"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Walk-In Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ animation: 'modalIn 0.2s ease-out' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Walk-In Patient</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Department: {departments.find(d => d._id === selectedDept)?.name}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Patient search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient *</label>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="input-field mb-2"
                  placeholder="Type patient name or email..."
                />
                {patients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {patients.map(p => (
                      <button
                        key={p._id}
                        onClick={() => {
                          setAddForm({ ...addForm, patientId: p._id });
                          setPatientSearch(`${p.userId?.firstName} ${p.userId?.lastName}`);
                          setPatients([]);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors
                          ${addForm.patientId === p._id ? 'bg-primary-50' : ''}`}
                      >
                        <span className="font-medium">{p.userId?.firstName} {p.userId?.lastName}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.userId?.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                {addForm.patientId && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check size={12} /> Patient selected
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Visit *</label>
                <textarea
                  value={addForm.reason}
                  onChange={e => setAddForm({ ...addForm, reason: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Brief description of why the patient is here..."
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex gap-2">
                  {(['normal', 'urgent', 'emergency'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setAddForm({ ...addForm, priority: p })}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all capitalize
                        ${addForm.priority === p
                          ? p === 'emergency' ? 'border-red-500 bg-red-50 text-red-700'
                            : p === 'urgent' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAddWalkIn} disabled={addSaving} className="btn-primary gap-1">
                {addSaving ? 'Adding...' : <><UserPlus size={16} /> Add to Queue</>}
              </button>
            </div>
          </div>
          <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
        </div>
      )}
    </div>
  );
};

export default WalkInPage;