import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Smile,
  Paperclip,
  Mic,
  Image as ImageIcon,
  FileText,
  Video,
  X,
  Loader2
} from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import { ComposerReplyBanner } from './ReplyPreview';
import { notify } from '@/components/common/ToastProvider';

export const MessageComposer = ({
  onSendMessage,
  onSendAttachment,
  onSendVoice,
  replyingTo = null,
  onCancelReply,
  onTypingStart,
  onTypingStop,
  isUploading = false,
  uploadProgress = 0,
  disabled = false,
  isKeyboardOpen = false
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  // Pending attachment preview before send (e.g. image caption)
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);

  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const attachmentMenuRef = useRef(null);

  const fileInputImageRef = useRef(null);
  const fileInputDocRef = useRef(null);
  const fileInputVideoRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = isKeyboardOpen ? 96 : 130;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [content, isKeyboardOpen]);

  // Cleanup typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  // Click outside to close attachment menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target)) {
        setShowAttachmentMenu(false);
      }
    };
    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachmentMenu]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setContent(val);

    if (!isTypingRef.current && val.trim().length > 0) {
      isTypingRef.current = true;
      onTypingStart?.();
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop?.();
    }, 1500);
  };

  const handleSend = () => {
    // If there is a pending selected attachment, send as attachment
    if (selectedFile) {
      onSendAttachment?.(selectedFile, content.trim(), replyingTo?.id);
      setSelectedFile(null);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
      setContent('');
      return;
    }

    if (!content.trim() || disabled) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      onTypingStop?.();
    }

    onSendMessage(content.trim(), replyingTo?.id);
    setContent('');
    setShowEmojiPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // On mobile touch screens, let Return key create newline; use Send button to submit
      const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
      if (!isTouch) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSelectEmoji = (emoji) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Attachment selection
  const handleFileChange = (e, category) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size client-side
    const maxSizes = {
      image: 10 * 1024 * 1024,
      document: 20 * 1024 * 1024,
      video: 50 * 1024 * 1024
    };

    if (maxSizes[category] && file.size > maxSizes[category]) {
      const mb = Math.round(maxSizes[category] / (1024 * 1024));
      notify.error(`${category.toUpperCase()} size cannot exceed ${mb}MB`);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setShowAttachmentMenu(false);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
  };

  const handleVoiceSend = (blob, duration) => {
    setIsVoiceRecording(false);
    onSendVoice?.(blob, duration, replyingTo?.id);
  };

  return (
    <div className="bg-brand-surface/90 border-t border-brand-border backdrop-blur-md relative flex flex-col">
      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full bg-brand-border/40 h-1 overflow-hidden">
          <div
            className="bg-brand-primary h-full transition-all duration-200"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Quoted Reply Banner */}
      {replyingTo && (
        <ComposerReplyBanner
          replyMessage={replyingTo}
          onCancel={onCancelReply}
        />
      )}

      {/* Pending File Attachment Preview Banner */}
      {selectedFile && (
        <div className="flex items-center justify-between p-2.5 bg-brand-surface/95 border-b border-brand-border/40 text-xs animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            {filePreviewUrl ? (
              <img
                src={filePreviewUrl}
                alt="Upload preview"
                className="w-10 h-10 object-cover rounded-lg border border-brand-border shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-white truncate max-w-xs">
                {selectedFile.name}
              </div>
              <div className="text-[10px] text-brand-subtle font-mono">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Add a caption below
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearSelectedFile}
            className="p-1 rounded-lg text-brand-subtle hover:text-white hover:bg-white/5 transition-colors"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Main Composer Controls Bar */}
      <div
        className="p-2 xs:p-3 shrink-0 bg-brand-surface/90 border-t border-brand-border/60 backdrop-blur-md transition-[padding] duration-150"
        style={{ paddingBottom: isKeyboardOpen ? '0.375rem' : 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {isVoiceRecording ? (
          <VoiceRecorder
            onSendVoice={handleVoiceSend}
            onCancel={() => setIsVoiceRecording(false)}
          />
        ) : (
          <div className="flex items-end gap-1.5 xs:gap-2 bg-brand-card border border-brand-border rounded-2xl px-2 py-1 xs:px-3 xs:py-1.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all relative shadow-sm">
            {/* Hidden File Inputs */}
            <input
              ref={fileInputImageRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'image')}
            />
            <input
              ref={fileInputDocRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'document')}
            />
            <input
              ref={fileInputVideoRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'video')}
            />

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-1.5 xs:p-2 rounded-xl transition-colors shrink-0 ${
                showEmojiPicker
                  ? 'text-brand-primary bg-brand-primary/10'
                  : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title="Add emoji"
              disabled={disabled || isUploading}
              aria-label="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Attachment Button & Dropdown Menu */}
            <div className="relative shrink-0" ref={attachmentMenuRef}>
              <button
                type="button"
                onClick={() => setShowAttachmentMenu((prev) => !prev)}
                className={`p-1.5 xs:p-2 rounded-xl transition-colors ${
                  showAttachmentMenu
                    ? 'text-brand-primary bg-brand-primary/10'
                    : 'text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Attach file"
                disabled={disabled || isUploading}
                aria-label="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Attachment Popup Menu */}
              {showAttachmentMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-52 max-w-[calc(100vw-32px)] bg-brand-surface border border-brand-border rounded-2xl shadow-elevated py-1.5 z-40 animate-fade-in divide-y divide-brand-border/40">
                  <button
                    type="button"
                    onClick={() => fileInputImageRef.current?.click()}
                    className="w-full px-3.5 py-2.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="font-semibold">Photos & Images</div>
                      <div className="text-[10px] text-brand-muted">PNG, JPG, WEBP (10MB)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputDocRef.current?.click()}
                    className="w-full px-3.5 py-2.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-violet-500" />
                    <div>
                      <div className="font-semibold">Document</div>
                      <div className="text-[10px] text-brand-muted">PDF, DOCX, ZIP (20MB)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputVideoRef.current?.click()}
                    className="w-full px-3.5 py-2.5 text-xs text-left text-brand-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <Video className="w-4 h-4 text-rose-500" />
                    <div>
                      <div className="font-semibold">Video</div>
                      <div className="text-[10px] text-brand-muted">MP4, WEBM (50MB)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Text Input Area */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFile
                  ? 'Add a caption...'
                  : 'Type a message...'
              }
              rows={1}
              disabled={disabled || isUploading}
              className="flex-1 min-w-0 max-h-28 py-1.5 xs:py-2 px-1 text-base sm:text-sm bg-transparent text-brand-text placeholder-brand-muted/70 border-none resize-none focus:outline-none focus:ring-0 leading-relaxed"
            />

            {/* Voice Record / Send Button */}
            {!content.trim() && !selectedFile ? (
              <button
                type="button"
                onClick={() => setIsVoiceRecording(true)}
                disabled={disabled || isUploading}
                className="p-2 xs:p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-all shrink-0"
                title="Record voice message"
                aria-label="Record voice message"
              >
                <Mic className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || isUploading}
                className="p-2 xs:p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-glow-primary active:scale-95 transition-all shrink-0 flex items-center justify-center cursor-pointer"
                title="Send"
                aria-label="Send message"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageComposer;
