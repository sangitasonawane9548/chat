import React from 'react';
import { AlertCircle } from 'lucide-react';

export const FormError = ({ message }) => {
  if (!message) return null;

  return (
    <div className="p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/30 text-brand-danger flex items-start gap-2.5 text-xs animate-fadeIn">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{message}</span>
    </div>
  );
};

export default FormError;

