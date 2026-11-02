import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export const AdminStatCard = ({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  color = 'primary', // primary, secondary, amber, danger
  subtitle
}) => {
  const colorStyles = {
    primary: {
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      text: 'text-brand-primary',
      glow: 'shadow-glow-primary'
    },
    secondary: {
      bg: 'bg-brand-secondary/10',
      border: 'border-brand-secondary/20',
      text: 'text-brand-secondary',
      glow: 'shadow-glow-secondary'
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      glow: 'shadow-lg shadow-amber-500/10'
    },
    danger: {
      bg: 'bg-brand-danger/10',
      border: 'border-brand-danger/20',
      text: 'text-brand-danger',
      glow: 'shadow-lg shadow-brand-danger/10'
    }
  }[color] || {};

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="glass-card rounded-2xl p-4 sm:p-5 border border-brand-border hover:border-brand-border-strong transition-all flex flex-col justify-between min-w-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted truncate">
            {title}
          </p>
          <h3 className="text-xl sm:text-2xl font-bold text-brand-text mt-1 tracking-tight truncate">
            {value}
          </h3>
        </div>

        {Icon && (
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border', colorStyles.bg, colorStyles.border, colorStyles.text)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-brand-border/40 text-xs">
        {change !== undefined && (
          <span className={cn('inline-flex items-center gap-1 font-semibold text-[11px] shrink-0', isPositive ? 'text-emerald-400' : 'text-brand-danger')}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{change}</span>
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] text-brand-subtle truncate">
            {subtitle}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default AdminStatCard;

