import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertCircle } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { uploadAvatar } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

export const ProfilePictureUpload = ({ currentAvatar, name, onUploaded }) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid format. Only JPG, PNG, and WEBP images are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Maximum image size is 5MB.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  const handleCancelPreview = () => {
    setSelectedFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setProgress(0);
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const res = await uploadAvatar(formData, (percent) => setProgress(percent));
      if (res.success) {
        notify.success('Profile avatar updated successfully!');
        if (onUploaded) {
          onUploaded(res.avatar_url);
        }
        handleCancelPreview();
      }
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar
          src={preview || currentAvatar}
          name={name}
          size="2xl"
          shape="rounded"
          className="ring-4 ring-brand-primary/20 shadow-xl"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-2 -right-2 p-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white shadow-glow-primary transition-all focus:outline-none"
          title="Choose photo"
          aria-label="Upload photo"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {preview && (
        <div className="flex flex-col items-center gap-2 animate-fadeIn w-full max-w-xs">
          <p className="text-[11px] text-brand-muted">Preview ready</p>

          {uploading && (
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-brand-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleUpload}
              isLoading={uploading}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Save Avatar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelPreview}
              disabled={uploading}
              leftIcon={<X className="w-3.5 h-3.5" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-brand-danger flex items-center gap-1.5 text-center">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <p className="text-[11px] text-brand-subtle text-center">
        JPG, PNG or WEBP up to 5MB
      </p>
    </div>
  );
};

export default ProfilePictureUpload;

