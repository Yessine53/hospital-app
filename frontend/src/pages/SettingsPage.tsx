import React, { useEffect, useState } from 'react';
import {
  Settings, Building2, Brain, Bell, Calendar, ScrollText,
  Save, RefreshCw, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Setting {
  _id: string;
  key: string;
  value: any;
  category: string;
  label: string;
  description?: string;
  updatedBy?: { firstName: string; lastName: string };
  updatedAt: string;
}

interface AuditEntry {
  _id: string;
  userId: { firstName: string; lastName: string; role: string };
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

const TABS = [
  { id: 'general', label: 'Hospital Info', icon: <Building2 size={18} /> },
  { id: 'prediction', label: 'Risk Thresholds', icon: <Brain size={18} /> },
  { id: 'reminders', label: 'Reminders', icon: <Bell size={18} /> },
  { id: 'scheduling', label: 'Scheduling', icon: <Calendar size={18} /> },
  { id: 'audit', label: 'Audit Logs', icon: <ScrollText size={18} /> },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, auditPage]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      setSettings(res.data.data.settings);
      // Initialize edited values
      const vals: Record<string, any> = {};
      res.data.data.settings.forEach((s: Setting) => { vals[s.key] = s.value; });
      setEditedValues(vals);
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Could not load settings. Make sure the settings route is registered.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/settings/audit-logs', { params: { page: auditPage, limit: 30 } });
      setAuditLogs(res.data.data);
      setAuditTotal(res.data.pagination.total);
      setAuditPages(res.data.pagination.pages);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleSave = async () => {
    const updates = Object.entries(editedValues)
      .filter(([key, val]) => {
        const original = settings.find((s) => s.key === key);
        return original && original.value !== val;
      })
      .map(([key, value]) => ({ key, value }));

    if (updates.length === 0) {
      toast('No changes to save', { icon: 'ℹ️' });
      return;
    }

    setSaving(true);
    try {
      await api.put('/settings/bulk-update', { updates });
      toast.success(`Saved ${updates.length} setting${updates.length > 1 ? 's' : ''}`);
      fetchSettings();
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (key: string, value: any) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const categorySettings = settings.filter((s) => s.category === activeTab);
  const hasChanges = Object.entries(editedValues).some(([key, val]) => {
    const original = settings.find((s) => s.key === key);
    return original && original.value !== val;
  });

  const renderSettingInput = (s: Setting) => {
    const val = editedValues[s.key] ?? s.value;
    const isChanged = val !== s.value;

    if (typeof s.value === 'boolean') {
      return (
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{s.label}</p>
            {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
          </div>
          <button
            onClick={() => updateValue(s.key, !val)}
            className={`relative w-11 h-6 rounded-full transition-colors ${val ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${val ? 'translate-x-[22px]' : 'translate-x-1'}`} />
          </button>
        </div>
      );
    }

    if (typeof s.value === 'number') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">{s.label}</label>
          {s.description && <p className="text-xs text-gray-400 mb-2">{s.description}</p>}
          <input
            type="number"
            value={val}
            onChange={(e) => updateValue(s.key, parseFloat(e.target.value) || 0)}
            className={`input-field max-w-xs ${isChanged ? 'ring-2 ring-primary-300' : ''}`}
            step={s.key.includes('threshold') ? 0.05 : 1}
            min={0}
          />
        </div>
      );
    }

    // String
    return (
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">{s.label}</label>
        {s.description && <p className="text-xs text-gray-400 mb-2">{s.description}</p>}
        <input
          type="text"
          value={val}
          onChange={(e) => updateValue(s.key, e.target.value)}
          className={`input-field ${isChanged ? 'ring-2 ring-primary-300' : ''}`}
        />
      </div>
    );
  };

  const actionLabels: Record<string, string> = {
    create: 'Created', update: 'Updated', delete: 'Deleted',
    confirm: 'Confirmed', cancel: 'Cancelled',
    update_setting: 'Changed setting', bulk_update_settings: 'Bulk updated settings',
    login: 'Logged in',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-500">Configure hospital operations, risk thresholds, and reminders</p>
        </div>
        {activeTab !== 'audit' && (
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className={`btn-primary gap-2 ${!hasChanges ? 'opacity-50' : ''}`}>
            {saving ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-surface-100 rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${activeTab === tab.id ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Settings content */}
      {activeTab !== 'audit' ? (
        <div className="card p-6">
          {categorySettings.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Settings size={40} className="mx-auto mb-3 opacity-30" />
              <p>No settings found for this category.</p>
              <p className="text-xs mt-1">Settings are initialized on first server start.</p>
            </div>
          ) : (
            <div className="space-y-6 divide-y divide-gray-100">
              {categorySettings.map((s) => (
                <div key={s.key} className="pt-5 first:pt-0">
                  {renderSettingInput(s)}
                  {s.updatedBy && (
                    <p className="text-[10px] text-gray-300 mt-2">
                      Last updated by {s.updatedBy.firstName} {s.updatedBy.lastName} on {new Date(s.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prediction thresholds visual */}
          {activeTab === 'prediction' && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Risk level preview</p>
              <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden">
                <div className="bg-emerald-400 h-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(editedValues.risk_threshold_medium || 0.3) * 100}%` }}>
                  Low
                </div>
                <div className="bg-amber-400 h-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${((editedValues.risk_threshold_high || 0.6) - (editedValues.risk_threshold_medium || 0.3)) * 100}%` }}>
                  Medium
                </div>
                <div className="bg-red-400 h-full flex-1 flex items-center justify-center text-white text-xs font-medium">
                  High
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0%</span>
                <span>{((editedValues.risk_threshold_medium || 0.3) * 100).toFixed(0)}%</span>
                <span>{((editedValues.risk_threshold_high || 0.6) * 100).toFixed(0)}%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Audit logs tab */
        <div className="card overflow-hidden">
          {auditLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ScrollText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No audit logs yet</p>
              <p className="text-xs mt-1">Actions like login, appointment changes, and settings updates will appear here</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 bg-surface-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">{auditTotal.toLocaleString()} total events</p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={12} /> Most recent first
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {auditLogs.map((log) => (
                  <div key={log._id} className="px-5 py-3 flex items-start gap-3 hover:bg-surface-50 transition-colors">
                    {/* Avatar */}
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-semibold text-primary-700">
                        {log.userId?.firstName?.[0]}{log.userId?.lastName?.[0]}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">{log.userId?.firstName} {log.userId?.lastName}</span>
                        {' '}
                        <span className="text-gray-500">
                          {actionLabels[log.action] || log.action}
                        </span>
                        {' '}
                        <span className="text-gray-600">{log.entity?.toLowerCase()}</span>
                      </p>
                      {log.details && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {log.details.method && `${log.details.method} ${log.details.path}`}
                          {log.details.key && `${log.details.key} → ${JSON.stringify(log.details.newValue)}`}
                          {log.details.keys && `Keys: ${log.details.keys.join(', ')}`}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-gray-300">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {auditPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">Page {auditPage} of {auditPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setAuditPage(auditPage - 1)} disabled={auditPage <= 1}
                      className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
                    <button onClick={() => setAuditPage(auditPage + 1)} disabled={auditPage >= auditPages}
                      className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"><ChevronRight size={16} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
