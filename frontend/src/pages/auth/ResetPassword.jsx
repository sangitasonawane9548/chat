import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { submitPasswordReset } from '@/services/api';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordStrength from '@/components/auth/PasswordStrength';
import AuthButton from '@/components/auth/AuthButton';
import FormError from '@/components/auth/FormError';
import { notify } from '@/components/common/ToastProvider';

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token || !email) {
      setError('Invalid password reset link. Missing token or email parameters.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitPasswordReset({
        token,
        email,
        newPassword,
        confirmPassword
      });

      if (res.success) {
        setIsSuccess(true);
        notify.success('Your password has been reset successfully!');
      } else {
        setError(res.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password. Link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Enter a new strong password for your MELT account"
      maxWidth="max-w-md"
      backTo="/login"
      backLabel="Sign In"
    >
      {isSuccess ? (
        <div className="space-y-5 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-brand-secondary/15 text-brand-secondary border border-brand-secondary/30 flex items-center justify-center mx-auto shadow-glow-secondary">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-brand-text">Password Updated</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              Your password has been changed securely and any prior active device sessions have been revoked.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-brand-primary hover:bg-brand-primary-hover text-white shadow-glow-primary transition-all"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormError message={error} />

          {!token && (
            <div className="p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-xs">
              Missing security token in link. Please use the exact link sent to your email.
            </div>
          )}

          <div>
            <PasswordInput
              label="New Password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting || !token}
            />
            <PasswordStrength password={newPassword} />
          </div>

          <PasswordInput
            label="Confirm New Password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting || !token}
          />

          <AuthButton
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!token || !newPassword || !confirmPassword}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Update Password
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

export default ResetPassword;

