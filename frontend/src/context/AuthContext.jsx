import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
  verifyEmailOtp,
  resendVerificationOtp
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Check and restore active user session from HTTP-only cookie
   */
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getCurrentUser();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
        localStorage.removeItem('melt_token');
      }
    } catch (err) {
      // 401 simply means no active session, which is expected for logged out users
      setUser(null);
      localStorage.removeItem('melt_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check session on initial application load / browser refresh
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Login function
   */
  const login = async ({ usernameOrEmail, password, rememberMe }) => {
    try {
      setAuthError(null);
      const response = await loginUser({ usernameOrEmail, password, rememberMe });
      if (response.success && response.user) {
        if (response.token) {
          localStorage.setItem('melt_token', response.token);
        }
        setUser(response.user);
        notify.success(`Welcome back, @${response.user.username}!`);
        return { success: true, user: response.user };
      }
      return { success: false, message: response.message || 'Login failed' };
    } catch (error) {
      const message = error.message || 'Login failed';
      setAuthError(message);
      return {
        success: false,
        message,
        isUnverified: error.data?.isUnverified,
        email: error.data?.email
      };
    }
  };

  /**
   * Registration function
   */
  const register = async (formData) => {
    try {
      setAuthError(null);
      const response = await registerUser(formData);
      return response;
    } catch (error) {
      const message = error.message || 'Registration failed';
      setAuthError(message);
      return {
        success: false,
        message,
        isUnverified: error.data?.isUnverified,
        email: error.data?.email
      };
    }
  };

  /**
   * Email Verification function
   */
  const verifyEmail = async ({ email, otp }) => {
    try {
      setAuthError(null);
      const response = await verifyEmailOtp({ email, otp });
      return response;
    } catch (error) {
      const message = error.message || 'Verification failed';
      setAuthError(message);
      return { success: false, message };
    }
  };

  /**
   * Resend Verification OTP
   */
  const resendOtp = async ({ email }) => {
    try {
      const response = await resendVerificationOtp({ email });
      return response;
    } catch (error) {
      return { success: false, message: error.message || 'Failed to resend code' };
    }
  };

  /**
   * Logout function
   */
  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('melt_token');
      setUser(null);
      notify.info('You have been logged out.');
    }
  };

  /**
   * Refresh current user profile details
   */
  const refreshUser = async () => {
    try {
      const data = await getCurrentUser();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      // Session expired
      setUser(null);
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    verifyEmail,
    resendOtp,
    logout,
    checkAuth,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

