import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, CheckCircle2, RotateCw, ArrowLeft, Edit3, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthLayout from '@/components/auth/AuthLayout';
import OTPInput from '@/components/auth/OTPInput';
import AuthButton from '@/components/auth/AuthButton';
import FormError from '@/components/auth/FormError';
import { notify } from '@/components/common/ToastProvider';

export const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendOtp } = useAuth();

  // Safely restore registered email even after page refresh
  const initialEmail =
    location.state?.email ||
    sessionStorage.getItem('pending_registration_email') ||
    '';
  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);

  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);

  // 60-second cooldown timer for resend
  useEffect(() => {
    let timer = null;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please provide your registered email address');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit verification code');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await verifyEmail({ email: email.trim().toLowerCase(), otp });

      if (res.success) {
        // Clear pending registration state
        sessionStorage.removeItem('pending_registration_email');
        sessionStorage.removeItem('pending_registration_username');

        notify.success('Account successfully activated! You can now log in.');
        navigate('/login', {
          state: {
            verifiedEmail: email.trim().toLowerCase(),
            justVerified: true
          }
        });
      } else {
        setError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setError('');

    if (!email.trim()) {
      setError('Please enter your email to resend code');
      return;
    }

    try {
      setIsResending(true);
      const res = await resendOtp({ email: email.trim().toLowerCase() });
      if (res.success) {
        notify.success(res.message || 'A new 6-digit verification code has been dispatched.');
        setCountdown(60);
        setOtp('');
      } else {
        setError(res.message || 'Failed to resend verification code');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error requesting new verification code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify Your Email"
      subtitle="Enter the 6-digit verification code to complete your MELT registration."
      maxWidth="max-w-md"
      backTo="/login"
      backLabel="Sign In"
    >
      <div className="space-y-5">
        <FormError message={error} />

        {/* Demo Mode Notice Badge */}
        <div className="p-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-brand-primary font-medium">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Demo Mode Active</span>
          </div>
          <span className="font-mono font-bold text-white bg-brand-primary/20 px-2 py-0.5 rounded border border-brand-primary/30">
            OTP: 123456
          </span>
        </div>

        {/* Target Email Box with Change Option */}
        <div className="p-3.5 rounded-xl bg-[#11151F] border border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-brand-subtle uppercase tracking-wider font-semibold">
                Registered Email
              </p>
              {isEditingEmail ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    sessionStorage.setItem('pending_registration_email', e.target.value);
                  }}
                  placeholder="Enter your email"
                  className="bg-transparent border-b border-brand-primary text-xs text-white focus:outline-none w-full py-0.5"
                  autoFocus
                />
              ) : (
                <p className="text-xs font-medium text-white truncate">{email || 'No email provided'}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingEmail(!isEditingEmail)}
            className="text-[11px] text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1 shrink-0 ml-2"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditingEmail ? 'Save' : 'Change Email'}</span>
          </button>
        </div>

        {/* 6-Digit OTP Box Component */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-brand-muted uppercase tracking-wider block text-center">
            Enter 6-Digit Code
          </label>
          <OTPInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              if (error) setError('');
            }}
            disabled={isSubmitting}
            error={Boolean(error)}
          />
        </div>

        {/* Verify Action Button */}
        <AuthButton
          type="button"
          onClick={handleVerify}
          isLoading={isSubmitting}
          disabled={otp.length !== 6}
          variant="primary"
          rightIcon={<CheckCircle2 className="w-4 h-4" />}
        >
          Verify OTP
        </AuthButton>

        {/* Resend OTP & Countdown */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-border/60">
          <span className="text-brand-subtle">Didn't receive code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || isResending}
            className="font-medium text-brand-secondary hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
          >
            <RotateCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
            {countdown > 0 ? `Resend OTP (${countdown}s)` : 'Resend OTP'}
          </button>
        </div>

        {/* Back Link */}
        <div className="text-center pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
