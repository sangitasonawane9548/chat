import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, Check, X, Eye, UserX, RefreshCw, Filter } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { getAdminReports, updateAdminReport } from '@/services/adminApi';
import { notify } from '@/components/common/ToastProvider';

export const AdminReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeReport, setActiveReport] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await getAdminReports();
      if (res.success) {
        setReports(
          (res.reports || []).map((r) => ({
            ...r,
            reporter: r.reporter_username || r.reporter || 'anonymous',
            reported_user: r.reported_username || r.reported_user || (r.group_name ? `Group: ${r.group_name}` : 'Target'),
            report_status: r.status || r.report_status || 'pending'
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      await updateAdminReport(reportId, {
        status: newStatus,
        admin_notes: `Processed via Admin Queue (${newStatus})`,
        action_taken: newStatus === 'resolved' ? 'sanction_applied' : 'dismissed'
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, report_status: newStatus, status: newStatus } : r))
      );
      notify.success(`Report #${reportId} status marked as ${newStatus}.`);
      setActiveReport(null);
    } catch (err) {
      notify.error(err.message || 'Failed to update report status');
    }
  };

  const filtered = reports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.report_status === statusFilter;
  });

  const columns = [
    {
      header: 'ID',
      render: (r) => <span className="font-mono text-brand-subtle text-xs">#{r.id}</span>
    },
    {
      header: 'Reported User',
      render: (r) => (
        <span className="font-semibold text-brand-danger text-xs">@{r.reported_user}</span>
      )
    },
    {
      header: 'Reporter',
      render: (r) => (
        <span className="text-brand-muted text-xs">@{r.reporter}</span>
      )
    },
    {
      header: 'Category',
      render: (r) => (
        <span className="text-amber-400 font-medium text-xs">{r.reason}</span>
      )
    },
    {
      header: 'Description',
      render: (r) => (
        <span className="text-brand-muted truncate max-w-[220px] block text-xs">
          {r.description}
        </span>
      )
    },
    {
      header: 'Status',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          r.report_status === 'pending'
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : r.report_status === 'resolved'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : r.report_status === 'under_review'
            ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30'
            : 'bg-white/10 text-brand-muted border border-white/15'
        }`}>
          {r.report_status}
        </span>
      )
    },
    {
      header: 'Action',
      render: (r) => (
        <button
          onClick={() => setActiveReport(r)}
          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition-colors flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span>Review</span>
        </button>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Reports & Moderation Queue</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {reports.filter((r) => r.report_status === 'pending').length} Pending
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Evaluate flagged harassment, spam, and offensive content reported by users
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchReports}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-brand-border flex items-center gap-1.5 overflow-x-auto text-xs">
        {['all', 'pending', 'under_review', 'resolved', 'dismissed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-xl capitalize font-medium transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-amber-500 text-black font-bold'
                : 'text-brand-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      <AdminDataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No reports matching filter criteria"
      />

      {/* Report Review Modal */}
      {activeReport && (
        <Modal
          isOpen={Boolean(activeReport)}
          onClose={() => setActiveReport(null)}
          title={`Moderation Ticket #${activeReport.id}`}
          description={`Report filed by @${activeReport.reporter} against @${activeReport.reported_user}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-brand-subtle font-semibold uppercase">Reason</span>
                <span className="text-amber-500 dark:text-amber-400 font-bold">{activeReport.reason}</span>
              </div>
              <div>
                <span className="text-[11px] text-brand-subtle font-semibold uppercase block mb-1">Details</span>
                <p className="text-brand-text leading-relaxed">{activeReport.description}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-border flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleUpdateStatus(activeReport.id, 'dismissed')}
                leftIcon={<X className="w-3.5 h-3.5 text-brand-subtle" />}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdateStatus(activeReport.id, 'under_review')}
              >
                Mark Under Review
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleUpdateStatus(activeReport.id, 'resolved')}
                leftIcon={<Check className="w-3.5 h-3.5" />}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold border-none"
              >
                Resolve & Sanction
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
};

export default AdminReports;

