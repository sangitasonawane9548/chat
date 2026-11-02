import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const AuthLoading = ({ message = 'Verifying secure session...' }) => {
  return (
    <div className="min-h-screen w-full bg-brand-bg flex flex-col items-center justify-center p-4 select-none transition-colors duration-300">
      <div className="relative mb-6">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -inset-4 bg-gradient-to-tr from-brand-primary to-brand-accent rounded-full blur-xl opacity-40"
        />
        <div className="relative w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center shadow-lg">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-accent flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-brand-primary animate-ping" />
        <p className="text-xs font-medium text-brand-muted tracking-wide">{message}</p>
      </div>
    </div>
  );
};

export default AuthLoading;

