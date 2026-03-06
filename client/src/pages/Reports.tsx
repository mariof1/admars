import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Shield, AlertTriangle, Users, Clock, Search,
  ChevronLeft, ChevronRight, Filter, Globe, CheckCircle, XCircle,
  TrendingUp, UserCheck, UserX, Lock, Loader2, Trash2
} from 'lucide-react';
import api from '../api/client';

interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  success: number;
}

interface Stats {
  eventsToday: number;
  failedToday: number;
  loginsToday: number;
  failedLoginsToday: number;
  uniqueIpsToday: number;
  actionBreakdown: { action: string; count: number }[];
  dailyActivity: { day: string; total: number; failed: number }[];
  topActors: { actor: string; count: number }[];
  recentFailedLogins: { actor: string; ip: string; timestamp: string }[];
  userStats: { total: number; enabled: number; disabled: number; locked: number };
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  CREATE_USER: 'bg-green-100 text-green-700',
  UPDATE_USER: 'bg-amber-100 text-amber-700',
  DELETE_USER: 'bg-red-100 text-red-700',
  ENABLE_USER: 'bg-emerald-100 text-emerald-700',
  DISABLE_USER: 'bg-orange-100 text-orange-700',
  UNLOCK_USER: 'bg-teal-100 text-teal-700',
  RESET_PASSWORD: 'bg-purple-100 text-purple-700',
  UPLOAD_PHOTO: 'bg-indigo-100 text-indigo-700',
  DELETE_PHOTO: 'bg-rose-100 text-rose-700',
  ADD_TO_GROUP: 'bg-cyan-100 text-cyan-700',
  REMOVE_FROM_GROUP: 'bg-pink-100 text-pink-700',
  MOVE_USER: 'bg-violet-100 text-violet-700',
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDay(day: string): string {
  const d = new Date(day + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// Simple bar chart component
function BarChart({ data, maxVal }: { data: { label: string; value: number; failed?: number }[]; maxVal: number }) {
  return (
    <div className="space-y-1">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right text-gray-500 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 flex items-center gap-1 h-5">
            <div
              className="h-full bg-brand-500 rounded-sm"
              style={{ width: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%`, minWidth: d.value > 0 ? '2px' : '0' }}
            />
            {d.failed !== undefined && d.failed > 0 && (
              <div
                className="h-full bg-red-400 rounded-sm"
                style={{ width: `${maxVal > 0 ? (d.failed / maxVal) * 100 : 0}%`, minWidth: '2px' }}
              />
            )}
          </div>
          <span className="w-8 text-right text-gray-600 font-medium">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<'dashboard' | 'logs'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [showPrune, setShowPrune] = useState(false);
  const [pruneOption, setPruneOption] = useState('30');
  const [pruning, setPruning] = useState(false);

  const pageSize = 25;

  useEffect(() => {
    setStatsLoading(true);
    api.getAuditStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false));
    api.getAuditActions().then(({ actions }) => setAvailableActions(actions)).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(logsPage),
        pageSize: String(pageSize),
      };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (successFilter) params.success = successFilter;

      const result = await api.getAuditLogs(params);
      setLogs(result.logs);
      setLogsTotal(result.total);
    } catch {} finally {
      setLogsLoading(false);
    }
  }, [logsPage, search, actionFilter, successFilter]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab, fetchLogs]);

  const totalPages = Math.ceil(logsTotal / pageSize);

  const handlePrune = async () => {
    setPruning(true);
    try {
      const { deleted } = await api.pruneAuditLogs(pruneOption);
      setShowPrune(false);
      fetchLogs();
      alert(`Pruned ${deleted} log entries.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPruning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Activity dashboard and audit logs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setTab('dashboard')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'dashboard' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp size={16} className="inline mr-2" />Dashboard
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'logs' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} className="inline mr-2" />Activity Logs
          </button>
        </div>
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        statsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Activity} label="Events Today" value={stats.eventsToday} color="blue" />
              <StatCard icon={Shield} label="Logins Today" value={stats.loginsToday} color="emerald" />
              <StatCard icon={AlertTriangle} label="Failed Logins" value={stats.failedLoginsToday} color="red" />
              <StatCard icon={Globe} label="Unique IPs" value={stats.uniqueIpsToday} color="purple" />
              <StatCard icon={Users} label="Total Users" value={stats.userStats.total} color="amber" />
            </div>

            {/* User breakdown + Action breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User stats */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users size={16} className="text-brand-600" />User Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><UserCheck size={14} className="text-green-500" />Enabled</span>
                    <span className="font-semibold text-gray-900">{stats.userStats.enabled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><UserX size={14} className="text-red-500" />Disabled</span>
                    <span className="font-semibold text-gray-900">{stats.userStats.disabled}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><Lock size={14} className="text-amber-500" />Locked</span>
                    <span className="font-semibold text-gray-900">{stats.userStats.locked}</span>
                  </div>
                </div>
                {stats.userStats.total > 0 && (
                  <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-green-500" style={{ width: `${(stats.userStats.enabled / stats.userStats.total) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(stats.userStats.disabled / stats.userStats.total) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(stats.userStats.locked / stats.userStats.total) * 100}%` }} />
                  </div>
                )}
              </div>

              {/* Action breakdown */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-brand-600" />Actions (30 days)
                </h3>
                {stats.actionBreakdown.length > 0 ? (
                  <BarChart
                    data={stats.actionBreakdown.map(a => ({ label: a.action.replace(/_/g, ' '), value: a.count }))}
                    maxVal={Math.max(...stats.actionBreakdown.map(a => a.count))}
                  />
                ) : (
                  <p className="text-sm text-gray-400">No activity yet</p>
                )}
              </div>

              {/* Top actors */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield size={16} className="text-brand-600" />Most Active Users (30 days)
                </h3>
                {stats.topActors.length > 0 ? (
                  <BarChart
                    data={stats.topActors.map(a => ({ label: a.actor, value: a.count }))}
                    maxVal={Math.max(...stats.topActors.map(a => a.count))}
                  />
                ) : (
                  <p className="text-sm text-gray-400">No activity yet</p>
                )}
              </div>
            </div>

            {/* Daily activity chart */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-brand-600" />Daily Activity (14 days)
              </h3>
              {stats.dailyActivity.length > 0 ? (
                <>
                  <BarChart
                    data={stats.dailyActivity.map(d => ({ label: formatDay(d.day), value: d.total, failed: d.failed }))}
                    maxVal={Math.max(...stats.dailyActivity.map(d => d.total))}
                  />
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-brand-500 rounded-sm inline-block" />Total</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-sm inline-block" />Failed</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No activity yet</p>
              )}
            </div>

            {/* Recent failed logins */}
            {stats.recentFailedLogins.length > 0 && (
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />Recent Failed Logins
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">User</th>
                        <th className="pb-2 font-medium">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentFailedLogins.map((l, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 text-gray-500 whitespace-nowrap">{formatTimestamp(l.timestamp)}</td>
                          <td className="py-2 font-medium text-gray-900">{l.actor}</td>
                          <td className="py-2 text-gray-500 font-mono text-xs">{l.ip || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-10">Failed to load stats</p>
        )
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9 w-full"
                  placeholder="Search actor, target, IP..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setLogsPage(1); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select
                  className="input text-sm"
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setLogsPage(1); }}
                >
                  <option value="">All actions</option>
                  {availableActions.map((a) => (
                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <select
                className="input text-sm"
                value={successFilter}
                onChange={(e) => { setSuccessFilter(e.target.value); setLogsPage(1); }}
              >
                <option value="">All results</option>
                <option value="true">Success</option>
                <option value="false">Failed</option>
              </select>
              <button
                onClick={() => setShowPrune(true)}
                className="btn-secondary text-sm px-3 py-2 text-red-600 hover:text-red-700 whitespace-nowrap"
              >
                <Trash2 size={14} className="inline mr-1" />Prune
              </button>
            </div>
          </div>

          {/* Prune modal */}
          {showPrune && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowPrune(false)}>
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Prune Activity Logs</h3>
                <p className="text-sm text-gray-500 mb-4">Permanently delete old log entries. This cannot be undone.</p>
                <label className="label">Delete logs older than</label>
                <select className="input w-full mb-4" value={pruneOption} onChange={(e) => setPruneOption(e.target.value)}>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setShowPrune(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handlePrune} disabled={pruning} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {pruning ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Delete Logs'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Logs table */}
          <div className="card overflow-hidden">
            {logsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Activity size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No logs found</p>
                <p className="text-sm mt-1">Activity will appear here as users interact with the system</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Time</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Target</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${log.success ? '' : 'bg-red-50/30'}`}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatTimestamp(log.timestamp)}</td>
                        <td className="px-4 py-2.5">
                          {log.success ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <XCircle size={16} className="text-red-500" />
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{log.actor}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{log.target || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[200px] truncate" title={log.detail || undefined}>{log.detail || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{log.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <p className="text-sm text-gray-500">
                  Showing {(logsPage - 1) * pageSize + 1}–{Math.min(logsPage * pageSize, logsTotal)} of {logsTotal}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage <= 1}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {logsPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setLogsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={logsPage >= totalPages}
                    className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
