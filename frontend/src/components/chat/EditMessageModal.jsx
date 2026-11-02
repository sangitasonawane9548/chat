import React, { useState, useEffect } from 'react';
import { Edit3, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export const EditMessageModal = ({ isOpen, onClose, message, onSave }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (message) {
      setContent(message.message_content || '');
      setError('');
    }
  }, [message]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Message content cannot be empty');
      return;
    }
    if (content.length > 5000) {
      setError('Message cannot exceed 5000 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSave(message.id, content.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Message" size="md">
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/30 flex items-center gap-2.5 text-xs text-brand-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-brand-muted">Message Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full px-3.5 py-2.5 text-sm bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors resize-none placeholder-brand-subtle"
            placeholder="Type your edited message..."
            maxLength={5000}
            autoFocus
          />
          <div className="flex justify-between items-center text-[11px] text-brand-subtle">
            <span>Messages can be edited within 15 minutes of sending.</span>
            <span>{content.length}/5000</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={loading}
            leftIcon={<Edit3 className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default EditMessageModal;

