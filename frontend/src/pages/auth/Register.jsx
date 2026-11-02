import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, AtSign, Mail, Check, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { checkUsernameAvailability } from '@/services/api';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordStrength from '@/components/auth/PasswordStrength';
import AuthButton from '@/components/auth/AuthButton';
import FormError from '@/components/auth/FormError';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { notify } from '@/components/common/ToastProvider';

export const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Username live availability state
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null,
    message: ''
  });

  // Debounced username availability check
  const checkUsernameDebounced = useCallback(
    (() => {
      let timeoutId = null;
      return (rawUsername) => {
        if (timeoutId) clearTimeout(timeoutId);

        const username = (rawUsername || '').trim();
        if (!username) {
          setUsernameStatus({ checking: false, available: null, message: '' });
          return;
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          setUsernameStatus({
            checking: false,
            available: false,
            message: '3-20 alphanumeric characters or underscores'
          });
          return;
        }

        setUsernameStatus({ checking: true, available: null, message: 'Checking handle...' });

        timeoutId = setTimeout(async () => {
          try {
            const data = await checkUsernameAvailability(username);
            setUsernameStatus({
              checking: false,
              available: data.available,
              message: data.message
            });
          } catch (err) {
            setUsernameStatus({
              checking: false,
              available: null,
              message: 'Could not verify username'
            });
          }
        }, 400);
      };
    })(),
    []
  );

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, username: val }));
    checkUsernameDebounced(val);
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.username.trim()) errs.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
      errs.username = '3-20 characters; letters, numbers, and underscores only';
    } else if (usernameStatus.available === false) {
      errs.username = 'Username is already taken';
    }

    if (!formData.email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please provide a valid email address';
    }

    if (!formData.password) errs.password = 'Password is required';
    else if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters';

    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeTerms) {
      errs.agreeTerms = 'You must accept the Terms and Conditions to proceed';
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const formErrors = validate();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await register(formData);

      if (res.success) {
        const registeredEmail = res.email || formData.email.trim().toLowerCase();
        sessionStorage.setItem('pending_registration_email', registeredEmail);
        sessionStorage.setItem('pending_registration_username', formData.username);

        notify.success(res.message || 'Account created! Enter the 6-digit code to verify.');
        navigate('/verify-email', {
          state: {
            email: registeredEmail,
            username: formData.username,
            isDemo: res.isDemo
          }
        });
      } else {
        if (res.isUnverified && res.email) {
          sessionStorage.setItem('pending_registration_email', res.email);
          notify.info(res.message);
          navigate('/verify-email', { state: { email: res.email } });
        } else {
          setServerError(res.message || 'Registration failed');
        }
      }
    } catch (err) {
      setServerError(err.message || 'An unexpected error occurred during registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to MELT"
      subtitle="Claim your permanent @username and keep conversations flowing."
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={serverError} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AuthInput
            label="Full Name"
            placeholder="e.g. Narendra Sonawane"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            error={errors.fullName}
            leftIcon={<User className="w-4 h-4" />}
          />

          {/* Username Input with Live Availability Indicator */}
          <div>
            <AuthInput
              label="Unique Username"
              placeholder="e.g. narendra_dev"
              value={formData.username}
              onChange={handleUsernameChange}
              error={errors.username}
              leftIcon={<AtSign className="w-4 h-4" />}
              rightIcon={
                formData.username && (
                  usernameStatus.checking ? (
                    <LoadingSpinner size="xs" />
                  ) : usernameStatus.available === true ? (
                    <span className="flex items-center text-brand-secondary text-xs">
                      <Check className="w-4 h-4" />
                    </span>
                  ) : usernameStatus.available === false ? (
                    <span className="flex items-center text-brand-danger text-xs">
                      <X className="w-4 h-4" />
                    </span>
                  ) : null
                )
              }
            />
            {/* Live Handle Availability Status Message */}
            {formData.username && usernameStatus.message && !errors.username && (
              <p
                className={`text-[11px] mt-1 font-medium ${
                  usernameStatus.available === true
                    ? 'text-brand-secondary'
                    : usernameStatus.available === false
                    ? 'text-brand-danger'
                    : 'text-brand-subtle'
                }`}
              >
                {usernameStatus.available === true ? '✓ ' : usernameStatus.available === false ? '✕ ' : ''}
                {usernameStatus.message}
              </p>
            )}
          </div>
        </div>

        <AuthInput
          label="Email Address"
          type="email"
          placeholder="e.g. dev@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          leftIcon={<Mail className="w-4 h-4" />}
          helperText="We will send a 6-digit confirmation code to this address"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <PasswordInput
              label="Password"
              placeholder="At least 8 chars"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
            />
            <PasswordStrength password={formData.password} />
          </div>

          <PasswordInput
            label="Confirm Password"
            placeholder="Repeat password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={errors.confirmPassword}
          />
        </div>

        {/* Terms Acceptance */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 text-xs text-brand-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.agreeTerms}
              onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
              className="mt-0.5 rounded bg-brand-sidebar border-brand-border text-brand-primary focus:ring-brand-primary/40"
            />
            <span>
              I accept the{' '}
              <a href="#terms" onClick={(e) => e.preventDefault()} className="text-brand-primary hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#privacy" onClick={(e) => e.preventDefault()} className="text-brand-primary hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="text-xs text-brand-danger mt-1">{errors.agreeTerms}</p>
          )}
        </div>

        <AuthButton
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="mt-4"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Create Encrypted Account
        </AuthButton>
      </form>

      {/* Switch to Login */}
      <p className="text-center text-xs text-brand-muted mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-primary font-medium hover:underline">
          Sign in here
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;

