import React, { useEffect, useState } from 'react';
import { departmentApi } from '../services/api';
import { Building2, Users, Clock } from 'lucide-react';
import type { Department } from '../types';

const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    departmentApi.getAll().then((res) => { setDepartments(res.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <p className="text-sm text-gray-500">{departments.length} active departments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <div key={dept._id} className="card-hover p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{dept.code} — Floor {dept.floor || 'N/A'}</p>
              </div>
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-primary-600" />
              </div>
            </div>

            {dept.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{dept.description}</p>
            )}

            {dept.specialties && dept.specialties.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {dept.specialties.map((s) => (
                    <span key={s._id} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
              <span className="flex items-center gap-1"><Clock size={12} /> {dept.defaultSlotDuration}min slots</span>
              {dept.phone && <span className="flex items-center gap-1">{dept.phone}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepartmentsPage;
