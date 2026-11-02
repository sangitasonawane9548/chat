import React, { useState, useEffect } from 'react';
import { FileText, ShieldAlert, Filter, RefreshCw, Terminal } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Button from '@/components/ui/Button';
import { getAdminAuditLogs } from '@/services/adminApi';

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await getAdminAuditLogs();
      if (res.success) {
        setLogs(
          (res.logs || []).map((l) => ({
            id: `LOG-${l.id}`,
            event: l.action || l.event || 'ADMIN_ACTION',
            actor: l.admin_username || l.actor || 'admin',
            target: l.target_type ? `${l.target_type}${l.target_id ? ` #${l.target_id}` : ''}` : (l.target || 'system'),
            ip: l.ip_address || l.ip || '127.0.0.1',
            severity:
              (l.action || '').includes('DELETE') || (l.action || '').includes('FAILED')
                ? 'danger'
                : (l.action || '').includes('SUSPEND')
                ? 'warning'
                : 'info',
            timestamp: l.created_at || l.timestamp || new Date().toISOString()
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return log.event.toLowerCase().includes(q) || log.actor.toLowerCase().includes(q) || log.target.toLowerCase().includes(q) || log.ip.includes(q);
  });

  const columns = [
    {
      header: 'ID',
      render: (l) => <span className="font-mono text-brand-subtle text-xs">{l.id}</span>
    },
    {
      header: 'Event Name',
      render: (l) => (
        <span className="font-mono font-semibold text-white text-xs">{l.event}</span>
      )
    },
    {
      header: 'Actor',
      render: (l) => (
        <span className="text-amber-400 font-medium text-xs">@{l.actor}</span>
      )
    },
    {
      header: 'Target Resource',
      render: (l) => (
        <span className="text-brand-muted text-xs">{l.target}</span>
      )
    },
    {
      header: 'IP Address',
      render: (l) => (
        <span className="font-mono text-brand-secondary text-xs">{l.ip}</span>
      )
    },
    {
      header: 'Severity',
      render: (l) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          l.severity === 'danger'
            ? 'bg-brand-danger/20 text-brand-danger border border-brand-danger/40'
            : l.severity === 'warning'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
        }`}>
          {l.severity}
        </span>
      )
    },
    {
      header: 'Timestamp',
      render: (l) => (
        <span className="text-brand-subtle text-[11px] font-mono">
          {new Date(l.timestamp).toLocaleString()}
        </span>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Security & Audit Trails</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
              Immutable Log
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Cryptographic ledger tracking administrative overrides, role promotions, and security events
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchLogs}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-brand-border flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-[11px] font-semibold text-brand-subtle mr-1">Severity:</span>
        {['all', 'info', 'warning', 'danger'].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={`px-3 py-1 rounded-xl capitalize font-medium transition-colors ${
              severityFilter === sev
                ? 'bg-brand-primary text-white font-bold'
                : 'text-brand-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      <AdminDataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter audit records by event, actor, IP..."
        emptyMessage="No audit logs matching query"
      />
    </PageTransition>
  );
};

export default AdminAuditLogs;

