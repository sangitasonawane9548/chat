import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  AtSign,
  Mail,
  Calendar,
  Camera,
  Shield,
  Edit3,
  Clock,
  Ban,
  ArrowLeft,
  MessageSquare,
  Lock,
  Globe
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PageTransition from '@/components/common/PageTransition';
import ChatRequestButton from '@/components/requests/ChatRequestButton';
import EditProfileModal from '@/components/profile/EditProfileModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { getUserProfile } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

export const UserProfilePage = () => {
  const { username: paramUsername } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  // If no username param, default to current authenticated user's username
  const targetUsername = (paramUsername || currentUser?.username || '').replace(/^@/, '');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchProfile = async () => {
    if (!targetUsername) return;
    try {
      setLoading(true);
      setError('');
      const res = await getUserProfile(targetUsername);
      if (res.success) {
        setProfile(res.profile);
      }
    } catch (err) {
      setError(err.message || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUsername]);

  const handleStatusChange = (userId, newStatus, newRequestId, newConversationId) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            relationship: newStatus,
            request_id: newRequestId !== undefined ? newRequestId : prev.request_id,
            conversation_id: newConversationId || prev.conversation_id
          }
        : null
    );
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<User className="w-8 h-8 text-brand-muted" />}
          title="Profile Not Found"
          description={`We couldn't locate a public profile for @${targetUsername}. The account may be inactive, private, or does not exist.`}
          actionLabel="Discover People"
          onAction={() => navigate('/discover')}
        />
      </div>
    );
  }

  const isOwnProfile = profile.is_own_profile;

  return (
    <PageTransition className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Top Banner & Header Card */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-6 sm:p-8 border border-brand-border shadow-elevated">
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-r from-violet-600/30 via-purple-600/20 to-rose-500/20" />

        <div className="relative pt-12 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
            <div className="relative group">
              <Avatar
                name={profile.full_name}
                src={profile.profile_picture}
                size="2xl"
                shape="rounded"
                status={profile.is_online ? 'online' : null}
                className="ring-4 ring-brand-bg shadow-xl"
              />
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="absolute bottom-0 right-0 p-2 rounded-xl bg-brand-primary text-white shadow-glow-primary hover:bg-brand-primary-hover transition-colors"
                  aria-label="Edit Profile Picture"
                  title="Change avatar"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-text tracking-tight">
                  {profile.full_name}
                </h2>
                {profile.is_online && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[11px] font-semibold border border-emerald-500/30">
                    Online
                  </span>
                )}
              </div>
              <p className="text-sm text-violet-500 font-medium">@{profile.username}</p>
            </div>
          </div>

          {/* Action Header Button */}
          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit Profile
              </Button>
            ) : (
              <ChatRequestButton
                user={profile}
                onStatusChange={handleStatusChange}
                size="md"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Public Information */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-brand-border shadow-sm">
            <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
              <User className="w-4 h-4 text-brand-primary" />
              <span>About & Details</span>
            </h3>

            <div>
              <span className="text-brand-muted uppercase tracking-wider text-[10px] font-semibold block mb-1">
                Bio
              </span>
              <p className="text-brand-text text-sm leading-relaxed bg-brand-surface p-3.5 rounded-xl border border-brand-border">
                {profile.bio || (
                  <span className="italic text-brand-muted">No bio provided.</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex items-center gap-3">
                <Calendar className="w-4 h-4 text-brand-primary" />
                <div>
                  <p className="text-[10px] text-brand-muted uppercase">Joined</p>
                  <p className="text-xs text-brand-text font-medium">
                    {profile.created_at
                      ? new Date(profile.created_at).toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex items-center gap-3">
                <Globe className="w-4 h-4 text-violet-500" />
                <div>
                  <p className="text-[10px] text-brand-muted uppercase">Discovery</p>
                  <p className="text-xs text-brand-text font-medium">
                    {profile.allow_chat_requests ? 'Accepts Requests' : 'Requests Disabled'}
                  </p>
                </div>
              </div>

              {isOwnProfile && profile.email && (
                <div className="p-3 rounded-xl bg-brand-surface border border-brand-border flex items-center gap-3 sm:col-span-2">
                  <Mail className="w-4 h-4 text-violet-500" />
                  <div>
                    <p className="text-[10px] text-brand-muted uppercase">Account Email (Private)</p>
                    <p className="text-xs text-brand-text font-medium">{profile.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Relationship & Status */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4 border border-brand-border shadow-sm">
            <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-500" />
              <span>Network Status</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-surface border border-brand-border">
                <span className="text-brand-muted">Presence</span>
                <span className="flex items-center gap-1.5 font-medium">
                  {profile.is_online ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-brand-online" />
                      <span className="text-brand-online">Online</span>
                    </>
                  ) : (
                    <span className="text-brand-muted">
                      {profile.last_seen
                        ? `Last seen ${new Date(profile.last_seen).toLocaleDateString()}`
                        : 'Offline'}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-surface border border-brand-border">
                <span className="text-brand-muted">Relationship</span>
                <span className="font-semibold text-brand-primary capitalize text-[11px]">
                  {isOwnProfile ? 'Your Account' : profile.relationship.replace('_', ' ')}
                </span>
              </div>
            </div>

            {!isOwnProfile && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-brand-danger hover:bg-brand-danger/10 hover:text-red-400"
                onClick={() => notify.info(`Block user functionality configured for safety.`)}
                leftIcon={<Ban className="w-3.5 h-3.5" />}
              >
                Block @{profile.username}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal for Own Account */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={(updated) => {
            setProfile((prev) => ({ ...prev, ...updated }));
          }}
        />
      )}
    </PageTransition>
  );
};

export default UserProfilePage;

