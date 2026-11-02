import React, { useState, useRef } from 'react';
import {
  X,
  Type,
  Image as ImageIcon,
  Video as VideoIcon,
  Smile,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Trash2,
  Check,
  Loader2,
  Sparkles
} from 'lucide-react';
import { createTextStatusApi, createMediaStatusApi } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

const BG_PALETTE = [
  { name: 'Dark Void', value: '#0B0D12' },
  { name: 'Midnight Slate', value: '#1E293B' },
  { name: 'Deep Emerald', value: '#064E3B' },
  { name: 'Royal Navy', value: '#1E3A8A' },
  { name: 'Imperial Violet', value: '#581C87' },
  { name: 'Electric Magenta', value: '#701A75' },
  { name: 'Burgundy Rose', value: '#831843' },
  { name: 'Desert Rust', value: '#7C2D12' },
  { name: 'Cyber Obsidian', value: '#18181B' },
];

const TEXT_PALETTE = [
  { name: 'Pure White', value: '#FFFFFF' },
  { name: 'Sun Yellow', value: '#FBBF24' },
  { name: 'Emerald Green', value: '#34D399' },
  { name: 'Cyan Blue', value: '#38BDF8' },
  { name: 'Lavender', value: '#A78BFA' },
  { name: 'Neon Coral', value: '#F87171' },
];

const QUICK_EMOJIS = ['😀', '🔥', '✨', '❤️', '🙌', '🎉', '🌟', '🚀', '😎', '💯', '👏', '🥳'];

export const CreateStatusModal = ({ isOpen, onClose, onCreated }) => {
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'image' | 'video'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Text status state
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#0B0D12');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState('medium'); // 'small' | 'medium' | 'large'
  const [textAlignment, setTextAlignment] = useState('center'); // 'left' | 'center' | 'right'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Media status state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [videoDuration, setVideoDuration] = useState(null);
  const [videoDurationWarning, setVideoDurationWarning] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setTextContent('');
    setBackgroundColor('#0B0D12');
    setTextColor('#FFFFFF');
    setFontSize('medium');
    setTextAlignment('center');
    setShowEmojiPicker(false);
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setCaption('');
    setVideoDuration(null);
    setVideoDurationWarning(null);
    setUploadProgress(0);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeTab === 'image') {
      if (!file.type.startsWith('image/')) {
        notify.error('Please select a valid image file (JPG, PNG, WEBP, GIF)');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        notify.error('Image size must be less than 15MB');
        return;
      }
    } else if (activeTab === 'video') {
      if (!file.type.startsWith('video/')) {
        notify.error('Please select a valid video file (MP4, WEBM, MOV)');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        notify.error('Video size must be less than 50MB');
        return;
      }
    }

    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }

    const preview = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaPreviewUrl(preview);
    setVideoDurationWarning(null);

    // If video, check duration
    if (activeTab === 'video') {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = preview;
      tempVideo.onloadedmetadata = () => {
        const dur = Math.round(tempVideo.duration);
        setVideoDuration(dur);
        if (dur > 60) {
          setVideoDurationWarning(`Video is ${dur}s long. Status stories play best under 60 seconds.`);
        }
      };
    }
  };

  const handleInsertEmoji = (emoji) => {
    if (activeTab === 'text') {
      setTextContent((prev) => prev + emoji);
    } else {
      setCaption((prev) => prev + emoji);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (activeTab === 'text') {
      if (!textContent.trim()) {
        notify.error('Please enter status text');
        return;
      }
      try {
        setIsSubmitting(true);
        const res = await createTextStatusApi({
          textContent: textContent.trim(),
          backgroundColor,
          textColor,
          fontSize,
          textAlignment,
        });

        if (res.success) {
          notify.success('Status posted successfully!');
          handleClose();
          if (onCreated) onCreated(res.status);
        } else {
          notify.error(res.message || 'Failed to post status');
        }
      } catch (err) {
        notify.error(err.message || 'Error posting text status');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Image or Video
      if (!mediaFile) {
        notify.error(`Please select a ${activeTab} file to upload`);
        return;
      }

      try {
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('file', mediaFile);
        if (caption.trim()) {
          formData.append('caption', caption.trim());
        }

        const res = await createMediaStatusApi(formData, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        });

        if (res.success) {
          notify.success(`${activeTab === 'image' ? 'Image' : 'Video'} status posted!`);
          handleClose();
          if (onCreated) onCreated(res.status);
        } else {
          notify.error(res.message || 'Failed to post media status');
        }
      } catch (err) {
        notify.error(err.message || 'Error uploading status media');
      } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small':
        return 'text-lg';
      case 'large':
        return 'text-3xl font-bold';
      case 'medium':
      default:
        return 'text-2xl font-semibold';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-brand-surface border border-brand-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-bold text-brand-text tracking-wide">Create Status Update</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-brand-border bg-brand-bg px-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setMediaFile(null);
              setMediaPreviewUrl(null);
            }}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'text'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Text Status</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('image');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'image'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image Status</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('video');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all ${
              activeTab === 'video'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            <VideoIcon className="w-4 h-4" />
            <span>Video Status</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'text' && (
            <div className="space-y-5">
              {/* Live Preview Card */}
              <div className="space-y-2">
                <span className="text-xs uppercase font-semibold text-brand-muted tracking-wider">Live Preview</span>
                <div
                  style={{
                    backgroundColor,
                    color: textColor,
                    textAlign: textAlignment,
                  }}
                  className={`w-full min-h-[220px] max-h-[260px] p-6 rounded-xl flex items-center justify-center transition-all duration-300 shadow-inner overflow-hidden select-none border border-white/10 ${getFontSizeClass()}`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed max-w-full">
                    {textContent.trim() || 'Type your status update...'}
                  </p>
                </div>
              </div>

              {/* Textarea Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <label className="font-medium text-gray-300">Status Message</label>
                  <span>{textContent.length}/1000</span>
                </div>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value.slice(0, 1000))}
                  placeholder="What's on your mind? Share an update with your contacts..."
                  rows={3}
                  className="w-full bg-brand-card border border-brand-border rounded-xl px-4 py-3 text-brand-text placeholder-brand-muted/60 focus:outline-none focus:border-brand-primary transition-all resize-none text-sm"
                />
              </div>

              {/* Quick Emojis */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-brand-muted mr-1">Quick Emoji:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleInsertEmoji(emoji)}
                    className="p-1 text-base hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Styling Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-brand-border">
                {/* Background Color Picker */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-brand-muted">Background</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {BG_PALETTE.map((bg) => (
                      <button
                        key={bg.value}
                        type="button"
                        onClick={() => setBackgroundColor(bg.value)}
                        style={{ backgroundColor: bg.value }}
                        title={bg.name}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                          backgroundColor === bg.value ? 'border-brand-primary scale-110' : 'border-brand-border'
                        }`}
                      >
                        {backgroundColor === bg.value && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Color Picker */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-brand-muted">Text Color</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {TEXT_PALETTE.map((tc) => (
                      <button
                        key={tc.value}
                        type="button"
                        onClick={() => setTextColor(tc.value)}
                        style={{ backgroundColor: tc.value }}
                        title={tc.name}
                        className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                          textColor === tc.value ? 'border-brand-primary scale-110' : 'border-brand-border'
                        }`}
                      >
                        {textColor === tc.value && <Check className="w-3.5 h-3.5 text-black" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size & Alignment */}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-brand-muted">Font & Alignment</span>
                  <div className="flex items-center gap-2">
                    {/* Font size */}
                    <div className="flex bg-brand-card border border-brand-border rounded-lg p-0.5">
                      {['small', 'medium', 'large'].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setFontSize(sz)}
                          className={`px-2 py-1 text-xs rounded uppercase font-bold transition-colors ${
                            fontSize === sz ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-text'
                          }`}
                        >
                          {sz[0]}
                        </button>
                      ))}
                    </div>

                    {/* Alignment */}
                    <div className="flex bg-brand-card border border-brand-border rounded-lg p-0.5">
                      {[
                        { align: 'left', icon: AlignLeft },
                        { align: 'center', icon: AlignCenter },
                        { align: 'right', icon: AlignRight },
                      ].map(({ align, icon: Icon }) => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setTextAlignment(align)}
                          className={`p-1 rounded transition-colors ${
                            textAlignment === align ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-brand-text'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'image' || activeTab === 'video') && (
            <div className="space-y-5">
              <input
                ref={fileInputRef}
                type="file"
                accept={activeTab === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/mp4,video/webm,video/quicktime'}
                onChange={handleFileChange}
                className="hidden"
              />

              {!mediaPreviewUrl ? (
                /* Dropzone placeholder */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-brand-border hover:border-brand-primary rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-brand-bg hover:bg-brand-card group min-h-[220px]"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-card group-hover:bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-3 transition-colors">
                    {activeTab === 'image' ? <ImageIcon className="w-7 h-7" /> : <VideoIcon className="w-7 h-7" />}
                  </div>
                  <p className="text-sm font-semibold text-brand-text mb-1">
                    Click or drag & drop {activeTab === 'image' ? 'an image' : 'a video'}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {activeTab === 'image' ? 'Supports JPG, PNG, WEBP, GIF (Up to 15MB)' : 'Supports MP4, WEBM, MOV (Up to 50MB)'}
                  </p>
                </div>
              ) : (
                /* Media Preview */
                <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[300px] border border-brand-border">
                  {activeTab === 'image' ? (
                    <img src={mediaPreviewUrl} alt="Status Preview" className="max-h-[300px] w-auto object-contain" />
                  ) : (
                    <video src={mediaPreviewUrl} controls className="max-h-[300px] w-full object-contain" />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(mediaPreviewUrl);
                      setMediaFile(null);
                      setMediaPreviewUrl(null);
                      setVideoDuration(null);
                      setVideoDurationWarning(null);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-red-600/80 text-white hover:bg-red-600 transition-colors shadow-lg"
                    title="Remove media"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {videoDurationWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-500 dark:text-amber-300">
                  {videoDurationWarning}
                </div>
              )}

              {/* Caption Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-brand-muted">
                  <label className="font-medium text-brand-text">Caption (Optional)</label>
                  <span>{caption.length}/500</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                    placeholder="Add a caption..."
                    className="w-full bg-brand-card border border-brand-border rounded-xl pl-4 pr-10 py-2.5 text-brand-text placeholder-brand-muted/60 focus:outline-none focus:border-brand-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* Quick Emojis for Caption */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-brand-muted mr-1">Add Emoji:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleInsertEmoji(emoji)}
                    className="p-1 text-base hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Upload Progress Bar */}
              {isSubmitting && uploadProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-brand-text">
                    <span>Uploading {activeTab}...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-brand-card rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (activeTab !== 'text' && !mediaFile) || (activeTab === 'text' && !textContent.trim())}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-violet-500/25 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Posting Status...</span>
                </>
              ) : (
                <span>Post Status</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateStatusModal;

