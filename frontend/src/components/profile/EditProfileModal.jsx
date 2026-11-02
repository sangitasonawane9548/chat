import React, { useState } from 'react';
import { User, AtSign, Check, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProfilePictureUpload from './ProfilePictureUpload';
import { updateOwnProfile } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';
import { useAuth } from '@/context/AuthContext';

export const EditProfileModal = ({ isOpen, onClose, onUpdated }) => {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [currentAvatar, setCurrentAvatar] = useState(user?.profile_picture || null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const bioLength = bio.length;
  const maxBioLength = 160;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    if (username.trim() && !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setError('Username must be 3-20 alphanumeric characters or underscores');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateOwnProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        bio: bio.trim()
      });

      if (res.success) {
        notify.success('Profile updated successfully!');
        await refreshUser();
        if (onUpdated) onUpdated(res.user);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Your Profile"
      description="Update your public profile details and avatar"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/30 text-brand-danger flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Picture Upload Section */}
        <div className="py-2 flex justify-center border-b border-brand-border/60">
          <ProfilePictureUpload
            currentAvatar={currentAvatar}
            name={fullName}
            onUploaded={(newUrl) => {
              setCurrentAvatar(newUrl);
              refreshUser();
            }}
          />
        </div>

        {/* Full Name Field */}
        <Input
          label="Full Name"
          placeholder="e.g. Narendra Sonawane"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          autoFocus
        />

        {/* Username Field */}
        <Input
          label="Username Handle"
          placeholder="e.g. narendra_dev"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          leftIcon={<AtSign className="w-4 h-4" />}
          helperText="Unique permanent handle on the MELT network"
        />

        {/* Bio with Live Character Counter */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-brand-muted uppercase tracking-wider">
              Bio
            </label>
            <span
              className={`text-[11px] ${
                bioLength > maxBioLength ? 'text-brand-danger font-semibold' : 'text-brand-subtle'
              }`}
            >
              {bioLength}/{maxBioLength}
            </span>
          </div>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, maxBioLength))}
            placeholder="Tell other users a little about yourself..."
            className="w-full bg-[#11151F]/90 text-brand-text placeholder-brand-subtle text-sm rounded-xl p-3 border border-brand-border focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 resize-none transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<Check className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditProfileModal;

