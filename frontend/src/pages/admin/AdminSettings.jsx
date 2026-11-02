import React, { useState, useEffect } from 'react';
import { Sliders, Save, Shield, Radio, Server, AlertTriangle } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import Button from '@/components/ui/Button';
import { notify } from '@/components/common/ToastProvider';
import { getAdminSettings, updateAdminSettings } from '@/services/adminApi';

export const AdminSettings = () => {
  const [config, setConfig] = useState({
    allowRegistration: true,
    maxGroupMembers: 100,
    maxFileSizeMb: 50,
    maintenanceMode: false,
    stunServer: 'stun:stun.l.google.com:19302',
    rateLimitPerMinute: 120
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await getAdminSettings();
        if (res.success && res.settings) {
          const s = res.settings;
          setConfig({
            allowRegistration: s.allow_registration !== undefined ? Boolean(s.allow_registration) : true,
            maxGroupMembers: Number(s.max_group_members) || 100,
            maxFileSizeMb: Number(s.max_file_size_mb) || 50,
            maintenanceMode: s.maintenance_mode !== undefined ? Boolean(s.maintenance_mode) : false,
            stunServer: s.stun_server || 'stun:stun.l.google.com:19302',
            rateLimitPerMinute: Number(s.rate_limit_per_minute) || 120
          });
        }
      } catch (err) {
        console.warn('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateAdminSettings({
        allow_registration: config.allowRegistration,
        max_group_members: config.maxGroupMembers,
        max_file_size_mb: config.maxFileSizeMb,
        maintenance_mode: config.maintenanceMode,
        stun_server: config.stunServer,
        rate_limit_per_minute: config.rateLimitPerMinute
      });
      notify.success('Platform configurations persisted to MySQL & server runtime');
    } catch (err) {
      notify.error(err.message || 'Failed to update configurations (Superadmin role required)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition className="space-y-6 max-w-5xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Global Platform Configuration</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Live Config
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Operational limits, WebRTC ICE servers, and platform security flags
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          isLoading={saving}
          leftIcon={<Save className="w-3.5 h-3.5" />}
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold border-none"
        >
          Save Configurations
        </Button>
      </div>

      <div className="space-y-6">
        {/* Registration & Security */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Registration & Access Gate</h3>
          </div>

          <div className="divide-y divide-brand-border/40 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Public Account Registration</p>
                <p className="text-[11px] text-brand-subtle">Allow new visitors to register unique @usernames</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, allowRegistration: !config.allowRegistration })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.allowRegistration ? 'bg-amber-500' : 'bg-white/10'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.allowRegistration ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Platform Maintenance Lockdown</p>
                <p className="text-[11px] text-brand-subtle">Only authenticated Superadmins can access chat interfaces</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.maintenanceMode ? 'bg-brand-danger' : 'bg-white/10'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Media & Group Limits */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
            <Server className="w-4 h-4 text-brand-primary" />
            <h3 className="text-sm font-bold text-white">Resource & Attachment Thresholds</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">
                Max Group Chat Capacity
              </label>
              <input
                type="number"
                value={config.maxGroupMembers}
                onChange={(e) => setConfig({ ...config, maxGroupMembers: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
              />
              <span className="text-[10px] text-brand-subtle mt-1 block">Maximum authorized participants per group</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">
                Max Media File Size (MB)
              </label>
              <input
                type="number"
                value={config.maxFileSizeMb}
                onChange={(e) => setConfig({ ...config, maxFileSizeMb: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
              />
              <span className="text-[10px] text-brand-subtle mt-1 block">Upper bound for video and document uploads</span>
            </div>
          </div>
        </div>

        {/* WebRTC ICE & Signaling */}
        <div className="glass-card rounded-2xl p-5 border border-brand-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-brand-border">
            <Radio className="w-4 h-4 text-brand-secondary" />
            <h3 className="text-sm font-bold text-brand-text">WebRTC P2P & STUN Infrastructure</h3>
          </div>

          <div className="text-xs space-y-3">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">
                Default STUN Server URI
              </label>
              <input
                type="text"
                value={config.stunServer}
                onChange={(e) => setConfig({ ...config, stunServer: e.target.value })}
                className="w-full px-3 py-2 bg-brand-surface text-brand-text font-mono rounded-xl border border-brand-border focus:outline-none focus:border-brand-secondary"
              />
              <span className="text-[10px] text-brand-subtle mt-1 block">Used by WebRTC peer connections for NAT traversal</span>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminSettings;

