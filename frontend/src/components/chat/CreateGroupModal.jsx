import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  Search,
  Check,
  AlertCircle,
  Camera,
  Loader2,
  Sparkles,
  Info
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import { createGroupApi, searchUsers, getUserSuggestions } from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

export const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setProfileImage('');
      setSearchQuery('');
      setSelectedMembers([]);
      setError('');

      // Load initial suggestions
      getUserSuggestions()
        .then((res) => {
          if (res.success && res.users) {
            setSearchResults(res.users);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      getUserSuggestions()
        .then((res) => {
          if (res.success && res.users) {
            setSearchResults(res.users);
          }
        })
        .catch(() => {});
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        const res = await searchUsers(searchQuery.trim(), 1, 20);
        if (res.success) {
          setSearchResults(res.users || []);
        }
      } catch (err) {
        console.error('[CreateGroupModal] Search error:', err);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleMemberSelection = (user) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.id === user.id);
      if (exists) {
        return prev.filter((m) => m.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
    setError('');
  };

  const removeMember = (userId) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 150) {
      setError('Group name must be between 3 and 150 characters');
      return;
    }

    if (selectedMembers.length < 2) {
      setError('You must add at least 2 members to create a group');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: trimmedName,
        description: description.trim() || undefined,
        profileImage: profileImage.trim() || undefined,
        memberIds: selectedMembers.map((m) => m.id)
      };

      const res = await createGroupApi(payload);
      if (res.success) {
        notify.success(`Group "${trimmedName}" created successfully!`);
        onGroupCreated?.(res.group, res.conversationId);
        onClose();
      }
    } catch (err) {
      console.error('[CreateGroupModal] Creation failed:', err);
      setError(err.message || 'Failed to create group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brand-text tracking-tight">Create New Group</h2>
              <p className="text-xs text-brand-muted">Start a collaborative real-time discussion</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-brand-danger/10 border border-brand-danger/30 flex items-start gap-2.5 text-xs text-brand-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">
                Group Name <span className="text-brand-danger">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                maxLength={150}
                placeholder="e.g. Design Systems Crew"
                className="w-full px-3.5 py-2 text-sm bg-brand-card text-brand-text placeholder-brand-subtle rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 transition-all"
                required
              />
              <div className="flex justify-between mt-1 text-[10px] text-brand-subtle">
                <span>Minimum 3 characters</span>
                <span>{name.length}/150</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1">
                Group Description <span className="text-brand-subtle font-normal">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="What is this group about?"
                className="w-full px-3.5 py-2 text-xs bg-brand-card text-brand-text placeholder-brand-subtle rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 transition-all resize-none"
              />
            </div>
          </div>

          {/* Selected Member Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-brand-muted">
                Add Members <span className="text-brand-danger">*</span>
              </label>
              <span
                className={`text-[11px] font-medium ${
                  selectedMembers.length >= 2 ? 'text-brand-secondary' : 'text-brand-primary'
                }`}
              >
                {selectedMembers.length} selected {selectedMembers.length < 2 && '(minimum 2 required)'}
              </span>
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-brand-card rounded-xl border border-brand-border/60 max-h-24 overflow-y-auto">
                {selectedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-primary/15 border border-brand-primary/30 text-xs text-brand-text"
                  >
                    <Avatar name={m.full_name} src={m.profile_picture} size="xs" shape="rounded" />
                    <span className="font-medium max-w-[120px] truncate">{m.full_name || `@${m.username}`}</span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-brand-muted hover:text-brand-text ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User Search Input */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people by username or name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-card text-brand-text placeholder-brand-subtle rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 transition-all"
              />
              {loadingSearch && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary animate-spin" />
              )}
            </div>

            {/* User List */}
            <div className="divide-y divide-brand-border/30 rounded-xl border border-brand-border/60 bg-brand-card/60 max-h-48 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((u) => {
                  const isSelected = selectedMembers.some((m) => m.id === u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleMemberSelection(u)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={u.full_name}
                          src={u.profile_picture}
                          size="sm"
                          shape="rounded"
                          status={u.is_online ? 'online' : null}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-brand-text truncate">{u.full_name}</p>
                          <p className="text-[10px] text-brand-subtle truncate">@{u.username}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-brand-primary border-brand-primary text-white'
                            : 'border-brand-border bg-transparent'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-brand-subtle">
                  {loadingSearch ? 'Searching users...' : 'No users found'}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-brand-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-surface shrink-0">
          <div className="text-[11px] text-brand-subtle flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-brand-primary shrink-0" />
            <span className="truncate">You will automatically become the group creator</span>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || name.trim().length < 3 || selectedMembers.length < 2}
              isLoading={submitting}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Create Group
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateGroupModal;

