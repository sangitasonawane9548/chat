import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import MeltLogo from '@/components/common/MeltLogo';
import ThemeToggle from '@/components/common/ThemeToggle';

export const AuthLayout = ({
  children,
  title,
  subtitle,
  maxWidth = 'max-w-md',
  backTo = null,
  backLabel = 'Back to Sign In'
}) => {
  return (
    <PageTransition className="min-h-screen w-full flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-brand-bg text-brand-text relative overflow-hidden py-10 sm:py-16 selection:bg-brand-primary/30 selection:text-white transition-colors duration-200">
      {/* Top action bar: Optional Back Navigation + Theme Toggle */}
      {backTo && (
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-surface border border-brand-border text-xs font-medium text-brand-muted hover:text-brand-text transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle size="sm" />
      </div>

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 sm:w-96 h-80 sm:h-96 bg-violet-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 sm:w-96 h-80 sm:h-96 bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className={`w-full ${maxWidth} z-10 flex flex-col`}>
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex justify-center mb-3">
            <MeltLogo size="lg" showBadge={true} badgeText="2.0" />
          </div>
          {title && (
            <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-text tracking-tight break-words">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-brand-muted mt-1 leading-relaxed px-2">
              {subtitle}
            </p>
          )}
        </div>

        {/* Auth Elevated Card */}
        <div className="rounded-3xl bg-brand-card border border-brand-border p-5 xs:p-7 sm:p-8 shadow-elevated">
          {children}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 flex items-center justify-center gap-2 text-[11px] text-brand-muted px-2">
          <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span>Encrypted Session • Rate-Limited Authentication Protocol</span>
        </div>
      </div>
    </PageTransition>
  );
};

export default AuthLayout;
