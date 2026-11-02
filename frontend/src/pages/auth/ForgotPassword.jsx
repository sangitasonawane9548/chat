import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { requestPasswordReset } from '@/services/api';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import FormError from '@/components/auth/FormError';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please provide a valid registered email address');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message || 'Error sending password reset request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Recover Password"
      subtitle="Enter your email and we'll send you a secure link to reset your account credentials"
      maxWidth="max-w-md"
      backTo="/login"
      backLabel="Sign In"
    >
      {isSubmitted ? (
        <div className="space-y-5 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/30 flex items-center justify-center mx-auto shadow-glow-secondary">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-brand-text">Reset Link Dispatched</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              If an account with <strong className="text-brand-text">{email}</strong> exists, you will receive an email shortly with instructions to reset your password. The link is active for 15 minutes.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-medium text-brand-primary hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />

          <AuthInput
            label="Registered Email Address"
            type="email"
            placeholder="e.g. dev@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            autoFocus
          />

          <AuthButton
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Send Recovery Link
          </AuthButton>

          <div className="text-center pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;

