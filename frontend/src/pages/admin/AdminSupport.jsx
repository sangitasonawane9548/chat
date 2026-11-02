import React, { useState } from 'react';
import { LifeBuoy, MessageSquare, CheckCircle, Clock, User, Check, Send } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { notify } from '@/components/common/ToastProvider';

export const AdminSupport = () => {
  const [tickets, setTickets] = useState([
    { id: 'TKT-401', user: 'alice', subject: 'WebRTC microphone permission error on iOS Safari', status: 'open', priority: 'high', created_at: '2026-11-01T14:20:00Z' },
    { id: 'TKT-400', user: 'bob', subject: 'Requesting username change assistance', status: 'in_progress', priority: 'medium', created_at: '2026-11-01T12:00:00Z' },
    { id: 'TKT-399', user: 'charlie', subject: '24-hour Status story video upload compression quality', status: 'resolved', priority: 'low', created_at: '2026-10-31T18:15:00Z' }
  ]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');

  const handleResolve = (ticketId) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'resolved' } : t))
    );
    notify.success(`Ticket ${ticketId} resolved.`);
    setSelectedTicket(null);
  };

  const columns = [
    {
      header: 'Ticket ID',
      render: (t) => <span className="font-mono text-brand-secondary font-bold text-xs">{t.id}</span>
    },
    {
      header: 'User',
      render: (t) => <span className="text-white font-semibold text-xs">@{t.user}</span>
    },
    {
      header: 'Subject',
      render: (t) => <span className="text-brand-text truncate max-w-[280px] block text-xs">{t.subject}</span>
    },
    {
      header: 'Priority',
      render: (t) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          t.priority === 'high'
            ? 'bg-brand-danger/20 text-brand-danger'
            : t.priority === 'medium'
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-white/10 text-brand-muted'
        }`}>
          {t.priority}
        </span>
      )
    },
    {
      header: 'Status',
      render: (t) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          t.status === 'open'
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : t.status === 'in_progress'
            ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30'
            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        }`}>
          {t.status.replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Action',
      render: (t) => (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setSelectedTicket(t)}
          leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
        >
          Respond
        </Button>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Support Desk & Inquiries</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {tickets.filter((t) => t.status !== 'resolved').length} Open
          </span>
        </h2>
        <p className="text-xs text-brand-muted mt-0.5">
          User help requests, onboarding troubleshooting, and audio/video calling diagnostics
        </p>
      </div>

      <AdminDataTable
        columns={columns}
        data={tickets}
        emptyMessage="No pending support tickets"
      />

      {/* Response Modal */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket: ${selectedTicket.id}`}
          description={`Issue submitted by @${selectedTicket.user}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border space-y-1">
              <span className="text-[10px] text-brand-subtle uppercase font-semibold">User Subject</span>
              <p className="text-brand-text font-medium">{selectedTicket.subject}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5">
                Admin Response Note
              </label>
              <textarea
                rows={3}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type response to dispatch to user in-app notification..."
                className="w-full px-3 py-2 text-xs bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="pt-3 border-t border-brand-border flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleResolve(selectedTicket.id)}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Send & Resolve
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
};

export default AdminSupport;

