import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AtSign, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import PasswordInput from '@/components/auth/PasswordInput';
import AuthButton from '@/components/auth/AuthButton';
import FormError from '@/components/auth/FormError';
import { notify } from '@/components/common/ToastProvider';
import { getDashboardRouteForUser } from '@/components/common/ProtectedRoute';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    usernameOrEmail: location.state?.verifiedEmail || '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const formErrors = {};

    if (!formData.usernameOrEmail.trim()) {
      formErrors.usernameOrEmail = 'Username or email is required';
    }
    if (!formData.password) {
      formErrors.password = 'Password is required';
    }

    setErrors(formErrors);
    if (Object.keys(formErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await login({
        usernameOrEmail: formData.usernameOrEmail.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe
      });

      if (res.success) {
        const roleDashboard = getDashboardRouteForUser(res.user);
        const fromPath = location.state?.from?.pathname;
        const isStaff = ['super_admin', 'admin', 'moderator', 'support_admin'].includes(res.user?.role);
        const destination = (fromPath && fromPath !== '/' && fromPath !== '/login' && fromPath !== '/register' && fromPath !== '/home' && !(isStaff && fromPath === '/dashboard'))
          ? fromPath
          : roleDashboard;
        navigate(destination, { replace: true });
      } else {
        if (res.isUnverified && res.email) {
          notify.error('Please verify your email address before logging in.');
          navigate('/verify-email', { state: { email: res.email } });
        } else {
          setServerError(res.message || 'Invalid username/email or password');
        }
      }
    } catch (err) {
      setServerError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Stay connected. Share moments. Keep conversations flowing."
      maxWidth="max-w-md"
    >
      {/* Just verified banner */}
      {location.state?.justVerified && (
        <div className="mb-4 p-3 rounded-xl bg-brand-secondary/10 border border-brand-secondary/30 text-brand-secondary flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Email verified! You can now log in to your account.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={serverError} />

        <AuthInput
          label="Username or Email"
          placeholder="e.g. alexander or user@example.com"
          value={formData.usernameOrEmail}
          onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
          error={errors.usernameOrEmail}
          leftIcon={<AtSign className="w-4 h-4" />}
          autoFocus={!location.state?.verifiedEmail}
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
          autoFocus={Boolean(location.state?.verifiedEmail)}
        />

        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 text-brand-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="rounded bg-brand-sidebar border-brand-border text-brand-primary focus:ring-brand-primary/40"
            />
            <span>Remember me (30 days)</span>
          </label>

          <Link
            to="/forgot-password"
            className="text-brand-primary hover:text-brand-primary-hover font-medium transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <AuthButton
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="mt-2"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In
        </AuthButton>
      </form>

      {/* Switch to Register */}
      <p className="text-center text-xs text-brand-muted mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-secondary font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;

