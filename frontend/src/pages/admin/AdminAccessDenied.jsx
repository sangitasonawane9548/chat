import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, KeyRound, Lock, AlertOctagon } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export const AdminAccessDenied = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <PageTransition className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-brand-bg relative overflow-hidden select-none transition-colors duration-300">
      {/* Background warning ambient glow */}
      <div className="absolute top-1/4 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-lg z-10 flex flex-col items-center text-center">
        {/* Warning Icon Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-red-500 shadow-2xl shadow-red-500/20">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-red-500 text-white tracking-wider">
            403 FORBIDDEN
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight mb-2">
          Administrative Access Denied
        </h1>
        <p className="text-sm text-brand-muted max-w-md mb-6 leading-relaxed">
          The <span className="text-brand-text font-semibold">MELT Admin Portal</span> is an isolated, restricted zone.
          Standard user accounts are strictly forbidden from viewing administrative dashboards, telemetry, or moderation queues.
        </p>

        {/* Identity Diagnostic Card */}
        <div className="w-full glass-card rounded-2xl p-4 sm:p-5 border border-red-500/20 bg-red-950/10 mb-6 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
            <span className="text-brand-subtle font-semibold uppercase tracking-wider text-[10px]">Current Identity</span>
            <span className="text-brand-text font-mono font-semibold">
              {user ? `@${user.username}` : 'Unauthenticated Visitor'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
            <span className="text-brand-subtle font-semibold uppercase tracking-wider text-[10px]">Assigned Role</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-surface text-brand-muted border border-brand-border">
              {user?.role || 'user'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-brand-subtle font-semibold uppercase tracking-wider text-[10px]">Permission Check</span>
            <span className="text-red-500 dark:text-red-400 font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Insufficient Administrative Clearance</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            className="w-full sm:w-auto text-xs"
          >
            Return to MELT
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/admin/login')}
            leftIcon={<KeyRound className="w-4 h-4" />}
            className="w-full sm:w-auto text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold border-none"
          >
            Admin Sign In
          </Button>
        </div>

        <p className="text-[11px] text-brand-subtle mt-8 flex items-center gap-1.5">
          <AlertOctagon className="w-3.5 h-3.5 text-brand-subtle" />
          <span>All unauthorized administrative access attempts are cryptographically audited.</span>
        </p>
      </div>
    </PageTransition>
  );
};

export default AdminAccessDenied;

