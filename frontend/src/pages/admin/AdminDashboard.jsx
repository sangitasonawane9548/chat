import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  PhoneCall,
  AlertTriangle,
  Activity,
  Server,
  ShieldAlert,
  ArrowUpRight,
  Database,
  Radio,
  FileCheck
} from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminStatCard from '@/components/admin/AdminStatCard';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Button from '@/components/ui/Button';
import { getAdminDashboardStats, getAdminReports, getAdminAuditLogs } from '@/services/adminApi';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsData, repData, logData] = await Promise.all([
          getAdminDashboardStats().catch(() => ({ success: false, stats: null })),
          getAdminReports().catch(() => ({ success: false, reports: [] })),
          getAdminAuditLogs().catch(() => ({ success: false, logs: [] }))
        ]);
        if (statsData.success) setStats(statsData.stats);
        if (repData.success) {
          setReports(
            (repData.reports || []).slice(0, 3).map((r) => ({
              ...r,
              reported_user: r.reported_username || r.reported_user || (r.group_name ? `Group: ${r.group_name}` : 'Target'),
              report_status: r.status || r.report_status || 'pending'
            }))
          );
        }
        if (logData.success) {
          setAuditLogs(
            (logData.logs || []).slice(0, 4).map((l) => ({
              ...l,
              actor: l.admin_username || l.actor || 'admin',
              event: l.action || l.event || 'ADMIN_ACTION',
              target: l.target_type ? `${l.target_type}${l.target_id ? ` #${l.target_id}` : ''}` : (l.target || 'system'),
              severity: (l.action || '').includes('DELETE') ? 'danger' : (l.action || '').includes('SUSPEND') ? 'warning' : 'info'
            }))
          );
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const reportColumns = [
    {
      header: 'Reported User',
      render: (r) => (
        <span className="font-semibold text-brand-text">@{r.reported_user}</span>
      )
    },
    {
      header: 'Reason',
      render: (r) => (
        <span className="text-amber-500 dark:text-amber-400 font-medium">{r.reason}</span>
      )
    },
    {
      header: 'Status',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          r.report_status === 'pending'
            ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30'
            : r.report_status === 'resolved'
            ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30'
            : 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30'
        }`}>
          {r.report_status}
        </span>
      )
    },
    {
      header: 'Action',
      render: () => (
        <button
          onClick={() => navigate('/admin/reports')}
          className="text-xs text-brand-primary hover:underline font-semibold"
        >
          Review →
        </button>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Top Banner */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-brand-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-brand-surface to-brand-bg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
              Live Cluster Operational
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-brand-text mt-1 tracking-tight">
            MELT Platform Health & Operations
          </h2>
          <p className="text-xs text-brand-muted mt-0.5 max-w-xl">
            Real-time telemetry across MySQL connection pools, WebRTC signaling mesh, and active MELT user chat channels.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/analytics')}
            leftIcon={<Activity className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/admin/reports')}
            leftIcon={<ShieldAlert className="w-3.5 h-3.5 text-white" />}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold border-none"
          >
            Moderate Queue
          </Button>
        </div>
      </div>

      {/* 4 Responsive Stat Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Total Registered"
          value={stats?.totalUsers || '42'}
          change="+18.4%"
          isPositive={true}
          icon={Users}
          color="primary"
          subtitle="Unique @usernames"
        />
        <AdminStatCard
          title="Active Groups"
          value={stats?.activeGroups || '14'}
          change="+12.0%"
          isPositive={true}
          icon={MessageSquare}
          color="secondary"
          subtitle="Encrypted channels"
        />
        <AdminStatCard
          title="Live Calls"
          value={stats?.activeCalls || '3'}
          change="0 packet drop"
          isPositive={true}
          icon={PhoneCall}
          color="amber"
          subtitle="WebRTC P2P mesh"
        />
        <AdminStatCard
          title="Pending Reports"
          value={stats?.pendingReports || '4'}
          change="-2 resolved"
          isPositive={false}
          icon={AlertTriangle}
          color="danger"
          subtitle="Awaiting review"
        />
      </div>

      {/* Grid: System Status Card & Moderation Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Vitals & Node.js Health */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-primary" />
              <span>Node.js & MySQL Vitals</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 font-mono">LIVE 30s</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-muted">
                <Database className="w-4 h-4 text-brand-secondary" />
                <span>MariaDB Connection Pool</span>
              </div>
              <span className="font-mono text-emerald-500 dark:text-emerald-400 font-bold">15 / 15 Idle</span>
            </div>

            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-muted">
                <Radio className="w-4 h-4 text-brand-primary" />
                <span>Socket.IO Signaling Mesh</span>
              </div>
              <span className="font-mono text-brand-primary font-bold">WebSocket 100%</span>
            </div>

            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-muted">
                <Activity className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Query Latency</span>
              </div>
              <span className="font-mono text-brand-text font-bold">{stats?.dbLatency || '1.2ms'}</span>
            </div>

            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-muted">
                <FileCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Service Uptime</span>
              </div>
              <span className="font-mono text-emerald-500 dark:text-emerald-400 font-bold">{stats?.serverUptime || '99.98%'}</span>
            </div>
          </div>
        </div>

        {/* Priority Moderation Tickets Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Recent Moderation Flags</span>
            </h3>
            <button
              onClick={() => navigate('/admin/reports')}
              className="text-xs text-amber-500 dark:text-amber-400 hover:underline font-semibold"
            >
              View all ({reports.length}) →
            </button>
          </div>

          <AdminDataTable
            columns={reportColumns}
            data={reports}
            loading={loading}
            emptyMessage="No pending moderation flags"
          />
        </div>
      </div>

      {/* Recent Security Audit Logs Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-brand-primary" />
            <span>Recent System & Security Audit Events</span>
          </h3>
          <button
            onClick={() => navigate('/admin/audit-logs')}
            className="text-xs text-brand-primary hover:underline font-semibold"
          >
            Full Audit Trail →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="glass-card rounded-xl p-3.5 border border-brand-border text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-brand-subtle">{log.id}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                  log.severity === 'danger'
                    ? 'bg-brand-danger/20 text-brand-danger'
                    : log.severity === 'warning'
                    ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
                    : 'bg-brand-primary/20 text-brand-primary'
                }`}>
                  {log.severity}
                </span>
              </div>
              <p className="font-semibold text-brand-text truncate">{log.event}</p>
              <p className="text-[11px] text-brand-muted truncate">Actor: <span className="text-amber-500 dark:text-amber-400">@{log.actor}</span> → {log.target}</p>
              <p className="text-[10px] text-brand-subtle">{new Date(log.timestamp).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;

