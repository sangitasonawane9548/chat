import React, { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Laptop,
  Shield,
  Phone,
  Save,
  Check,
  KeyRound,
  LogOut,
  Smartphone,
  Globe,
  UserX,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getActiveSessions,
  logoutAllSessions,
  changePassword,
  getUserSettingsApi,
  updateUserSettingsApi,
  getBlockedUsersApi,
  unblockUserApi
} from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Avatar from '@/components/ui/Avatar';
import PageTransition from '@/components/common/PageTransition';
import { notify } from '@/components/common/ToastProvider';

export const SettingsPage = () => {
  const { logout } = useAuth();
  const { theme, setTheme: setGlobalTheme } = useTheme();

  const [settings, setSettings] = useState({
    theme: theme || 'dark',
    show_last_seen: true,
    show_online_status: true,
    show_read_receipts: true,
    allow_username_search: true,
    call_permissions: 'everyone',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Change password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSessions();
    loadBlockedUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await getUserSettingsApi();
      if (res.success && res.settings) {
        setSettings((prev) => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      // Ignore background load error
    }
  };

  const loadBlockedUsers = async () => {
    try {
      setLoadingBlocked(true);
      const res = await getBlockedUsersApi();
      if (res.success) {
        setBlockedUsers(res.blockedUsers || []);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (targetUserId) => {
    try {
      const res = await unblockUserApi(targetUserId);
      if (res.success) {
        notify.success('User unblocked');
        setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      }
    } catch (err) {
      notify.error(err.message || 'Failed to unblock user');
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await getActiveSessions();
      if (res.success) {
        setSessions(res.sessions || []);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setIsSavingSettings(true);
      const res = await updateUserSettingsApi(settings);
      if (res.success) {
        notify.success('Settings and privacy saved successfully!');
      }
    } catch (err) {
      notify.error(err.message || 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      notify.error('Please fill all password fields');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      notify.error('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify.error('New passwords do not match');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await changePassword(passwordForm);
      if (res.success) {
        notify.success('Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      notify.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await logoutAllSessions();
      notify.success('All sessions have been revoked.');
      await logout();
    } catch (err) {
      notify.error('Failed to revoke sessions');
    }
  };

  return (
    <PageTransition className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Settings & Privacy</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Manage your account security, sessions, privacy, and theme
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSavingSettings}
          leftIcon={<Save className="w-3.5 h-3.5" />}
        >
          Save Preferences
        </Button>
      </div>

      <div className="space-y-6">
        {/* Section 1: Privacy Controls (Maps to user_settings DB) */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-brand-border">
            <Shield className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-semibold text-white">Privacy & Visibility</h3>
          </div>

          <div className="divide-y divide-brand-border/60">
            {/* Show Last Seen */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text">Show Last Seen</p>
                <p className="text-xs text-brand-muted">Allow other users to see when you were last active</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('show_last_seen')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.show_last_seen ? 'bg-brand-primary' : 'bg-white/10'
                }`}
                aria-label="Toggle show last seen"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.show_last_seen ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Show Online Status */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text">Show Online Presence</p>
                <p className="text-xs text-brand-muted">Display the green indicator when you are actively connected</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('show_online_status')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.show_online_status ? 'bg-brand-primary' : 'bg-white/10'
                }`}
                aria-label="Toggle online presence"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.show_online_status ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Read Receipts */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text">Read Receipts (Blue Ticks)</p>
                <p className="text-xs text-brand-muted">Let senders know when you have read their direct messages</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('show_read_receipts')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.show_read_receipts ? 'bg-brand-primary' : 'bg-white/10'
                }`}
                aria-label="Toggle read receipts"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.show_read_receipts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Allow Username Search */}
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-text">Allow Username Discovery</p>
                <p className="text-xs text-brand-muted">Allow non-contacts to find your profile by typing your username</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('allow_username_search')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.allow_username_search ? 'bg-brand-primary' : 'bg-white/10'
                }`}
                aria-label="Toggle username discovery"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.allow_username_search ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Blocked Users */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-brand-border">
            <UserX className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">Blocked Contacts</h3>
          </div>

          <p className="text-xs text-brand-muted">
            Blocked contacts cannot send you chat requests, messages, status updates, or calls.
          </p>

          {loadingBlocked ? (
            <div className="py-4 flex items-center justify-center text-xs text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary mr-2" />
              <span>Loading blocked contacts...</span>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#11151F]/40 border border-brand-border/40 text-center">
              <p className="text-xs text-gray-400">No blocked contacts</p>
            </div>
          ) : (
            <div className="divide-y divide-brand-border/40">
              {blockedUsers.map((bu) => (
                <div key={bu.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={bu.profile_picture}
                      name={bu.full_name || bu.username}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{bu.full_name || bu.username}</p>
                      <p className="text-[11px] text-gray-400">@{bu.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnblock(bu.id)}
                    className="text-xs text-rose-400 hover:text-white hover:bg-rose-500/20"
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Change Password */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-brand-border">
            <KeyRound className="w-4 h-4 text-brand-secondary" />
            <h3 className="text-sm font-semibold text-white">Security & Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
            <Input
              label="Current Password"
              type="password"
              placeholder="Enter current password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            />

            <Input
              label="New Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />

            <Button
              type="submit"
              variant="outline"
              size="sm"
              isLoading={changingPassword}
              className="mt-2"
            >
              Update Password
            </Button>
          </form>
        </div>

        {/* Section 3: Active Device Sessions */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <div className="flex items-center gap-2.5">
              <Laptop className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-semibold text-white">Active Device Sessions</h3>
            </div>
            {sessions.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleRevokeAllSessions}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                Revoke All Sessions
              </Button>
            )}
          </div>

          <p className="text-xs text-brand-muted">
            These devices currently have active HTTP-only sessions authenticated into your account.
          </p>

          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3 rounded-xl bg-[#11151F]/60 border border-brand-border flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-brand-muted">
                    {sess.device_info?.includes('Mobile') ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Laptop className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate max-w-xs">{sess.device_info}</p>
                      {sess.is_current && (
                        <span className="px-1.5 py-0.5 rounded-full bg-brand-online/15 text-brand-online text-[10px] font-bold">
                          Current Device
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-brand-subtle flex items-center gap-2 mt-0.5">
                      <span>IP: {sess.ip_address || 'Localhost'}</span>
                      <span>•</span>
                      <span>Created: {new Date(sess.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Call Permissions */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-brand-border">
            <Phone className="w-4 h-4 text-brand-secondary" />
            <h3 className="text-sm font-semibold text-white">Call Permissions</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              { id: 'everyone', label: 'Everyone', desc: 'Any user on MELT' },
              { id: 'contacts_only', label: 'Contacts Only', desc: 'People you have added' },
              { id: 'nobody', label: 'Nobody', desc: 'Block incoming calls' }
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSettings({ ...settings, call_permissions: option.id })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  settings.call_permissions === option.id
                    ? 'border-brand-primary bg-brand-primary/10 text-white shadow-glow-primary'
                    : 'border-brand-border bg-[#11151F]/60 text-brand-muted hover:border-brand-border-strong hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{option.label}</span>
                  {settings.call_permissions === option.id && (
                    <Check className="w-3.5 h-3.5 text-brand-primary" />
                  )}
                </div>
                <p className="text-[11px] text-brand-subtle">{option.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Interface Theme */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-brand-border">
            <Moon className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-brand-text">Interface Theme</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Deep Ink & Obsidian midnight theme' },
              { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Clean daylight aesthetic' },
              { id: 'system', label: 'System Default', icon: Laptop, desc: 'Matches operating system preference' }
            ].map((th) => {
              const Icon = th.icon;
              const isSelected = (settings.theme || theme) === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    setSettings({ ...settings, theme: th.id });
                    setGlobalTheme(th.id);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-text shadow-glow-primary'
                      : 'border-brand-border bg-brand-surface text-brand-muted hover:border-brand-border-strong hover:text-brand-text'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2.5 ${isSelected ? 'text-violet-500' : 'text-brand-muted'}`} />
                  <p className="text-xs font-bold text-brand-text mb-0.5">{th.label}</p>
                  <p className="text-[11px] text-brand-muted">{th.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default SettingsPage;
