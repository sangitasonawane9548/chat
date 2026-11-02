import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Lock, User, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { notify } from '@/components/common/ToastProvider';
import { adminLogin } from '@/services/adminApi';
import MeltLogo from '@/components/common/MeltLogo';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      notify.error('Admin security key or password required');
      return;
    }

    try {
      setLoading(true);
      const res = await adminLogin(username, password);
      if (res?.success) {
        notify.success(`Welcome to Admin Console, @${res.admin?.username || username}`);
        const role = res.admin?.role;
        const targetRoute = role === 'moderator' ? '/admin/moderation' : role === 'support_admin' ? '/admin/support' : '/admin/dashboard';
        navigate(targetRoute);
      } else {
        notify.error(res?.message || 'Admin authentication failed');
      }
    } catch (err) {
      notify.error(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition className="min-h-screen w-full flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-brand-bg text-brand-text relative overflow-hidden py-10 selection:bg-amber-500/30 selection:text-white transition-colors duration-200">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md z-10 flex flex-col">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex justify-center mb-3">
            <MeltLogo size="lg" variant="admin" showBadge={true} badgeText="ADMIN" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-text tracking-tight">MELT Admin & Moderator Portal</h2>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            Restricted area for platform architecture, moderation & telemetry
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-brand-card border border-brand-border p-5 xs:p-7 sm:p-8 shadow-elevated">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Identity"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              placeholder="Username or Admin ID"
              required
            />

            <Input
              label="Security Password / Passkey"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              placeholder="••••••••••••"
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold border-none shadow-md"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Enter Admin Console
              </Button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-brand-border/60 text-center">
            <Link to="/login" className="text-xs text-brand-muted hover:text-white transition-colors">
              ← User Sign In
            </Link>
          </div>
        </div>

        <div className="text-center mt-4 text-[11px] text-brand-subtle flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Audit Logged • RBAC Enforced • Zero-Trust Tunnel</span>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminLogin;

