import React from 'react';
import { Toaster, toast as hotToast } from 'react-hot-toast';

export const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#171D29',
          color: '#F8FAFC',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
          fontSize: '13px',
          fontWeight: '500',
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#35D6B5',
            secondary: '#0B0D12',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#0B0D12',
          },
        },
      }}
    />
  );
};

// Re-export toast helper methods for easy unified consumption
export const notify = {
  success: (msg, opts) => hotToast.success(msg, opts),
  error: (msg, opts) => hotToast.error(msg, opts),
  info: (msg, opts) => hotToast(msg, { icon: 'ℹ️', ...opts }),
  loading: (msg, opts) => hotToast.loading(msg, opts),
  dismiss: (id) => hotToast.dismiss(id),
};

export default ToastProvider;

