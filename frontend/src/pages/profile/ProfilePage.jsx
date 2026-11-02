import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  AtSign,
  Mail,
  Calendar,
  Camera,
  Shield,
  Edit3,
  KeyRound,
  Laptop
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageTransition from '@/components/common/PageTransition';
import { notify } from '@/components/common/ToastProvider';

export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState({
    fullName: user?.full_name || 'Narendra Dev',
    username: user?.username || 'narendra_dev',
    email: user?.email || 'dev@example.com',
    bio: user?.bio || 'Building high-throughput real-time communication systems.',
    isOnline: true,
    role: user?.role || 'user',
    createdAt: user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'November 2026',
  });

  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setIsEditing(false);
    notify.success('Profile updated.');
  };

  return (
    <PageTransition className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Banner Card */}
      <div className="relative rounded-2xl overflow-hidden glass-card p-6 sm:p-8">
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-r from-brand-primary/30 via-brand-secondary/20 to-purple-900/30" />

        <div className="relative pt-12 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            <div className="relative group">
              <Avatar
                name={profile.fullName}
                src={user?.profile_picture}
                size="2xl"
                status="online"
                className="ring-4 ring-brand-bg shadow-xl"
              />
              <button
                type="button"
                onClick={() => notify.info('Media uploads via Cloudinary scheduled for Day 4.')}
                className="absolute bottom-0 right-0 p-2 rounded-xl bg-brand-primary text-white shadow-glow-primary hover:bg-brand-primary-hover transition-colors"
                aria-label="Upload photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{profile.fullName}</h2>
                <span className="px-2 py-0.5 rounded-full bg-brand-online/15 text-brand-online text-[11px] font-semibold border border-brand-online/30">
                  Verified
                </span>
              </div>
              <p className="text-sm text-brand-muted">@{profile.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Editable Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-primary" />
              <span>Personal Information</span>
            </h3>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <Input
                  label="Full Name"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  leftIcon={<User className="w-4 h-4" />}
                />

                <Input
                  label="Username"
                  value={profile.username}
                  disabled
                  helperText="Unique username handle is permanent."
                  leftIcon={<AtSign className="w-4 h-4" />}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-brand-muted uppercase tracking-wider">
                    Bio / Status
                  </label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full bg-[#11151F]/90 text-brand-text placeholder-brand-subtle text-sm rounded-xl p-3 border border-brand-border focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-brand-subtle uppercase tracking-wider text-[10px] font-semibold block mb-1">
                    Bio
                  </span>
                  <p className="text-brand-text text-sm leading-relaxed bg-[#11151F]/60 p-3 rounded-xl border border-brand-border">
                    {profile.bio || 'No bio provided yet.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3 rounded-xl bg-[#11151F]/60 border border-brand-border flex items-center gap-3">
                    <Mail className="w-4 h-4 text-brand-secondary" />
                    <div>
                      <p className="text-[10px] text-brand-subtle uppercase">Email</p>
                      <p className="text-brand-text font-medium">{profile.email}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#11151F]/60 border border-brand-border flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-brand-primary" />
                    <div>
                      <p className="text-[10px] text-brand-subtle uppercase">Joined</p>
                      <p className="text-brand-text font-medium">{profile.createdAt}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Security & Role status */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-secondary" />
              <span>Account Status</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#11151F]/60 border border-brand-border">
                <span className="text-brand-muted">Account Tier</span>
                <span className="font-semibold text-brand-primary uppercase text-[11px]">{profile.role}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#11151F]/60 border border-brand-border">
                <span className="text-brand-muted">Presence</span>
                <span className="flex items-center gap-1.5 text-brand-online font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-online" />
                  Online
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#11151F]/60 border border-brand-border">
                <span className="text-brand-muted">Verification</span>
                <span className="text-brand-secondary font-medium">Email Verified</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              leftIcon={<KeyRound className="w-3.5 h-3.5" />}
              onClick={() => notify.info('Password change & sessions available in Settings.')}
            >
              Security Settings
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default ProfilePage;
