import React, { useEffect, useState } from 'react';
import { patientApi } from '../services/api';
import { Users, Search, Plus, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Patient, Pagination } from '../types';
import { usePermission } from '../hooks/usePermission';

interface PatientForm {
  email: string; password: string; firstName: string; lastName: string;
  phone: string; dateOfBirth: string; gender: string; bloodType: string;
  communicationPreference: string; allergies: string;
  address: { street: string; city: string; state: string; zipCode: string; country: string };
  emergencyContact: { name: string; relationship: string; phone: string };
}

const emptyForm: PatientForm = {
  email: '', password: 'Patient123!', firstName: '', lastName: '', phone: '',
  dateOfBirth: '', gender: '', bloodType: '', communicationPreference: 'both', allergies: '',
  address: { street: '', city: '', state: '', zipCode: '', country: 'Malta' },
  emergencyContact: { name: '', relationship: '', phone: '' },
};

const PatientsPage: React.FC = () => {
  const { can } = usePermission();
  const canWrite = can('patients:write');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Patient modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchPatients = async (page = 1) => {
    setLoading(true);
    try {
      const res = await patientApi.getAll({ page, limit: 20, search: search || undefined });
      setPatients(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => fetchPatients(), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const openAddModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.dateOfBirth || !form.gender) {
      toast.error('Please fill in all required fields (name, email, DOB, gender)');
      return;
    }
    setSaving(true);
    try {
      await patientApi.create({
        ...form,
        allergies: form.allergies ? form.allergies.split(',').map(a => a.trim()) : [],
      });
      toast.success('Patient created successfully');
      setShowModal(false);
      fetchPatients(pagination.page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-sm text-gray-500">{pagination.total} registered patients</p>
        </div>
        {canWrite && (
          <button onClick={openAddModal} className="btn-primary gap-2"><Plus size={16} /> Add Patient</button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="input-field pl-9"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No patients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Gender</th>
                  <th className="table-header">Age</th>
                  <th className="table-header">Appointments</th>
                  <th className="table-header">No-Shows</th>
                  <th className="table-header">No-Show Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p) => {
                  const rate = p.totalAppointments > 0
                    ? ((p.noShowCount / p.totalAppointments) * 100).toFixed(0) + '%'
                    : 'N/A';
                  const rateColor = p.totalAppointments === 0 ? 'text-gray-400'
                    : (p.noShowCount / p.totalAppointments) > 0.3 ? 'text-red-600 font-semibold'
                    : (p.noShowCount / p.totalAppointments) > 0.15 ? 'text-amber-600'
                    : 'text-emerald-600';
                  return (
                    <tr key={p._id} className="hover:bg-surface-50 transition-colors cursor-pointer">
                      <td className="table-cell font-medium">
                        {p.userId?.firstName} {p.userId?.lastName}
                      </td>
                      <td className="table-cell text-gray-500">{p.userId?.email}</td>
                      <td className="table-cell">{p.userId?.phone || '—'}</td>
                      <td className="table-cell capitalize">{p.gender}</td>
                      <td className="table-cell">{p.age}</td>
                      <td className="table-cell">{p.totalAppointments}</td>
                      <td className="table-cell">{p.noShowCount}</td>
                      <td className={`table-cell ${rateColor}`}>{rate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchPatients(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => fetchPatients(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'modalIn 0.2s ease-out' }}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl z-10">
              <h3 className="text-lg font-semibold text-gray-900">Add New Patient</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="input-field" placeholder="John" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="input-field" placeholder="Doe" />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="input-field" placeholder="patient@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="input-field" placeholder="+356 7XXX XXXX" />
                </div>
              </div>

              {/* DOB & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="input-field" max={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="input-field">
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Blood Type & Notifications */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                  <select value={form.bloodType} onChange={e => setForm({ ...form, bloodType: e.target.value })} className="input-field">
                    <option value="">Unknown</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t =>
                      <option key={t} value={t}>{t}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notifications</label>
                  <select value={form.communicationPreference} onChange={e => setForm({ ...form, communicationPreference: e.target.value })} className="input-field">
                    <option value="both">Email + SMS</option>
                    <option value="email">Email only</option>
                    <option value="sms">SMS only</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address.street} onChange={e => setForm({ ...form, address: { ...form.address, street: e.target.value } })}
                  className="input-field mb-2" placeholder="Street" />
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.address.city} onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })}
                    className="input-field" placeholder="City" />
                  <input value={form.address.zipCode} onChange={e => setForm({ ...form, address: { ...form.address, zipCode: e.target.value } })}
                    className="input-field" placeholder="Postal code" />
                  <input value={form.address.country} onChange={e => setForm({ ...form, address: { ...form.address, country: e.target.value } })}
                    className="input-field" placeholder="Country" />
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                <div className="grid grid-cols-3 gap-2">
                  <input value={form.emergencyContact.name} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })}
                    className="input-field" placeholder="Name" />
                  <input value={form.emergencyContact.relationship} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relationship: e.target.value } })}
                    className="input-field" placeholder="Relationship" />
                  <input value={form.emergencyContact.phone} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })}
                    className="input-field" placeholder="Phone" />
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergies (comma-separated)</label>
                <input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })}
                  className="input-field" placeholder="e.g. Penicillin, Latex" />
              </div>

              {/* Password info */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                The patient account will be created with default password: <span className="font-mono font-medium">Patient123!</span> — they should change it on first login.
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100 flex gap-3 justify-end rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary gap-1">
                {saving ? 'Creating...' : <><Check size={16} /> Create Patient</>}
              </button>
            </div>
          </div>
          <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;