import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { departmentApi, appointmentApi, patientApi, userApi } from '../services/api';
import { Calendar, Clock, User, Building2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Department, User as UserType, TimeSlot, Patient } from '../types';

const BookAppointmentPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<UserType[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Selection
  const [form, setForm] = useState({
    departmentId: '',
    doctorId: '',
    date: '',
    startTime: '',
    endTime: '',
    type: 'regular',
    reason: '',
    patientId: '',
  });

  useEffect(() => {
    departmentApi.getAll().then((res) => setDepartments(res.data.data));
    if (user?.role !== 'patient') {
      patientApi.getAll({ limit: '500' }).then((res) => setPatients(res.data.data));
    }
  }, [user]);

  useEffect(() => {
    if (form.departmentId) {
      departmentApi.getDoctors(form.departmentId).then((res) => setDoctors(res.data.data));
    }
  }, [form.departmentId]);

  useEffect(() => {
    if (form.doctorId && form.date) {
      appointmentApi
        .getSlots({ doctorId: form.doctorId, date: form.date, departmentId: form.departmentId })
        .then((res) => setSlots(res.data.data.slots));
    }
  }, [form.doctorId, form.date]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let patientId = form.patientId;

      // For patient role, find their patient record
      if (user?.role === 'patient') {
        const profileRes = await (await import('../services/api')).authApi.getProfile();
        patientId = profileRes.data.data.patientProfile?._id;
      }

      if (!patientId) {
        toast.error('Patient profile not found');
        return;
      }

      const selectedSlot = slots.find((s) => s.startTime === form.startTime);

      await appointmentApi.create({
        patientId,
        doctorId: form.doctorId,
        departmentId: form.departmentId,
        date: form.date,
        startTime: form.startTime,
        endTime: selectedSlot?.endTime || form.startTime,
        type: form.type,
        reason: form.reason,
      });

      toast.success('Appointment booked successfully!');
      navigate(user?.role === 'patient' ? '/my-appointments' : '/appointments');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = departments.find((d) => d._id === form.departmentId);
  const selectedDoc = doctors.find((d) => d._id === form.doctorId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book an Appointment</h1>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Department', icon: <Building2 size={16} /> },
          { n: 2, label: 'Doctor & Date', icon: <Calendar size={16} /> },
          { n: 3, label: 'Time Slot', icon: <Clock size={16} /> },
          { n: 4, label: 'Confirm', icon: <Check size={16} /> },
        ].map(({ n, label, icon }) => (
          <React.Fragment key={n}>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${step >= n ? 'bg-primary-50 text-primary-700' : 'text-gray-400'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > n ? <Check size={14} /> : n}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {n < 4 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-primary-400' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="card p-6">
        {/* Step 1: Select Department */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Department</h2>

            {/* Patient selector for staff */}
            {user?.role !== 'patient' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient</label>
                <select
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select patient...</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.userId?.firstName} {p.userId?.lastName} ({p.userId?.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {departments.map((dept) => (
                <button
                  key={dept._id}
                  onClick={() => { setForm({ ...form, departmentId: dept._id }); setStep(2); }}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-card-hover
                    ${form.departmentId === dept._id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'}`}
                >
                  <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{dept.code} — Floor {dept.floor || 'N/A'}</p>
                  {dept.specialties && dept.specialties.length > 0 && (
                    <p className="text-xs text-primary-600 mt-2">
                      {dept.specialties.map((s) => s.name).join(', ')}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Doctor & Date */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Select Doctor & Date — {selectedDept?.name}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor</label>
                <select
                  value={form.doctorId}
                  onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select doctor...</option>
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      Dr. {doc.firstName} {doc.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Appointment Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input-field"
              >
                <option value="regular">Regular Visit</option>
                <option value="follow_up">Follow-Up</option>
                <option value="consultation">Consultation</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!form.doctorId || !form.date}
                className="btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select Time Slot */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Select Time Slot</h2>
            <p className="text-sm text-gray-500">
              Dr. {selectedDoc?.firstName} {selectedDoc?.lastName} — {new Date(form.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {slots.length === 0 ? (
              <p className="text-gray-400 py-8 text-center">No slots available for this date</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.startTime}
                    onClick={() => slot.available && setForm({ ...form, startTime: slot.startTime, endTime: slot.endTime })}
                    disabled={!slot.available}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                      ${!slot.available
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                        : form.startTime === slot.startTime
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-400 hover:bg-primary-50'}`}
                  >
                    {slot.startTime}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={!form.startTime}
                className="btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Your Appointment</h2>

            <div className="bg-surface-50 rounded-xl p-5 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Department</span>
                <span className="text-sm font-medium">{selectedDept?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Doctor</span>
                <span className="text-sm font-medium">Dr. {selectedDoc?.firstName} {selectedDoc?.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm font-medium">
                  {new Date(form.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Time</span>
                <span className="text-sm font-medium">{form.startTime} - {form.endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Type</span>
                <span className="text-sm font-medium capitalize">{form.type.replace('_', ' ')}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for visit (optional)</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Describe your reason for the visit..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(3)} className="btn-secondary">Back</button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookAppointmentPage;
