import React, { useEffect, useState } from 'react';
import { reportApi } from '../services/api';
import { BarChart3, TrendingDown, PieChart } from 'lucide-react';

const ReportsPage: React.FC = () => {
  const [noShowData, setNoShowData] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [nsRes, ovRes] = await Promise.all([
          reportApi.noShows(dateRange),
          reportApi.overview(),
        ]);
        setNoShowData(nsRes.data.data);
        setOverview(ovRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const summary = noShowData?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">No-show trends, prediction accuracy, and operational metrics</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="input-field py-2 text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="input-field py-2 text-sm"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Appointments', value: summary.total || 0, color: 'bg-primary-50 text-primary-700' },
          { label: 'Attended', value: summary.attended || 0, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'No-Shows', value: summary.noShows || 0, color: 'bg-red-50 text-red-700' },
          { label: 'Cancelled', value: summary.cancelled || 0, color: 'bg-gray-100 text-gray-700' },
          { label: 'No-Show Rate', value: `${noShowData?.noShowRate || 0}%`, color: 'bg-amber-50 text-amber-700' },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color.split(' ')[1]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Department breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary-600" />
            No-Shows by Department
          </h3>
          {noShowData?.departmentBreakdown?.length > 0 ? (
            <div className="space-y-3">
              {noShowData.departmentBreakdown.map((dept: any) => {
                const rate = dept.total > 0 ? (dept.noShows / dept.total * 100).toFixed(1) : 0;
                return (
                  <div key={dept._id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{dept._id}</span>
                      <span className="text-gray-500">{dept.noShows} / {dept.total} ({rate}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${Math.min(Number(rate), 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No data available</p>
          )}
        </div>

        {/* Prediction accuracy */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <TrendingDown size={18} className="text-primary-600" />
            Prediction Accuracy by Risk Level
          </h3>
          {noShowData?.predictionAccuracy?.length > 0 ? (
            <div className="space-y-4">
              {noShowData.predictionAccuracy.map((level: any) => {
                const accuracy = level.total > 0 ? (level.actualNoShows / level.total * 100).toFixed(1) : 0;
                const barColor = level._id === 'high' ? 'bg-red-400' : level._id === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <div key={level._id} className="flex items-center gap-4">
                    <span className={`badge badge-${level._id} w-20 justify-center`}>{level._id}</span>
                    <div className="flex-1">
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${Math.min(Number(accuracy), 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-20 text-right">
                      {accuracy}% actual
                    </span>
                    <span className="text-xs text-gray-400">({level.actualNoShows}/{level.total})</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Train the ML model to see prediction accuracy</p>
          )}
        </div>
      </div>

      {/* Daily trend */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Daily Appointment & No-Show Trend</h3>
        {noShowData?.dailyBreakdown?.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex gap-1 items-end min-w-[600px] h-48">
              {noShowData.dailyBreakdown.slice(-30).map((day: any) => {
                const maxVal = Math.max(...noShowData.dailyBreakdown.map((d: any) => d.total), 1);
                const totalH = (day.total / maxVal) * 160;
                const noShowH = (day.noShows / maxVal) * 160;
                return (
                  <div key={day._id} className="flex-1 flex flex-col items-center gap-1" title={`${day._id}: ${day.total} appts, ${day.noShows} no-shows`}>
                    <div className="w-full flex flex-col items-center">
                      <div className="w-full bg-primary-200 rounded-t" style={{ height: `${totalH}px` }}>
                        <div className="w-full bg-red-400 rounded-t" style={{ height: `${noShowH}px` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{noShowData.dailyBreakdown[Math.max(0, noShowData.dailyBreakdown.length - 30)]?._id}</span>
              <span>{noShowData.dailyBreakdown[noShowData.dailyBreakdown.length - 1]?._id}</span>
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 bg-primary-200 rounded" /> Total
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 bg-red-400 rounded" /> No-Shows
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">No daily data available for this range</p>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
