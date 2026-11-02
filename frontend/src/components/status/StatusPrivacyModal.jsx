import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Users,
  UserX,
  UserCheck,
  Search,
  Check,
  Loader2,
  Lock
} from 'lucide-react';
import {
  getStatusPrivacyApi,
  updateStatusPrivacyApi,
  getUserConversations,
  getUserSuggestions
} from '@/services/api';
import Avatar from '@/components/ui/Avatar';
import { notify } from '@/components/common/ToastProvider';

export const StatusPrivacyModal = ({ isOpen, onClose, onUpdated }) => {
  const [privacyType, setPrivacyType] = useState('contacts'); // 'contacts' | 'contacts_except' | 'only_share_with'
  const [excludedUserIds, setExcludedUserIds] = useState([]);
  const [allowedUserIds, setAllowedUserIds] = useState([]);
  const [availableContacts, setAvailableContacts] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [privRes, convRes, sugRes] = await Promise.all([
          getStatusPrivacyApi(),
          getUserConversations().catch(() => ({ conversations: [] })),
          getUserSuggestions().catch(() => ({ suggestions: [] }))
        ]);

        if (isMounted && privRes.success) {
          const priv = privRes.privacy;
          setPrivacyType(priv.privacy_type || 'contacts');
          setExcludedUserIds(priv.excluded_user_ids || []);
          setAllowedUserIds(priv.allowed_user_ids || []);
        }

        // Aggregate unique contacts from direct conversations and suggestions
        const contactMap = new Map();

        if (convRes?.conversations) {
          convRes.conversations.forEach((c) => {
            if (c.other_user) {
              contactMap.set(c.other_user.id, c.other_user);
            }
          });
        }

        if (sugRes?.suggestions) {
          sugRes.suggestions.forEach((u) => {
            if (!contactMap.has(u.id)) {
              contactMap.set(u.id, u);
            }
          });
        }

        if (isMounted) {
          setAvailableContacts(Array.from(contactMap.values()));
        }
      } catch (err) {
        notify.error('Failed to load privacy settings');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleExclusion = (userId) => {
    setExcludedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleAllowed = (userId) => {
    setAllowedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await updateStatusPrivacyApi({
        privacyType,
        excludedUserIds,
        allowedUserIds
      });

      if (res.success) {
        notify.success('Status privacy settings updated');
        if (onUpdated) onUpdated(res.privacy);
        onClose();
      } else {
        notify.error(res.message || 'Failed to update privacy');
      }
    } catch (err) {
      notify.error(err.message || 'Error updating privacy');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredContacts = availableContacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const name = (c.full_name || '').toLowerCase();
    const uname = (c.username || '').toLowerCase();
    return name.includes(q) || uname.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-brand-surface border border-brand-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-bold text-brand-text tracking-wide">Status Privacy</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <p className="text-xs text-brand-muted">
            Choose who can see your status updates. Changes will apply only to new status updates you post.
          </p>

          {/* Privacy Options */}
          <div className="space-y-3">
            {/* My Contacts */}
            <label
              onClick={() => setPrivacyType('contacts')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                privacyType === 'contacts'
                  ? 'border-brand-primary bg-brand-primary/10 shadow-sm'
                  : 'border-brand-border bg-brand-surface hover:border-brand-border-strong'
              }`}
            >
              <input
                type="radio"
                name="statusPrivacy"
                value="contacts"
                checked={privacyType === 'contacts'}
                onChange={() => setPrivacyType('contacts')}
                className="mt-1 text-brand-primary focus:ring-brand-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-primary" />
                  <span className="font-semibold text-brand-text text-sm">My Contacts</span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  All mutual contacts can view your status updates.
                </p>
              </div>
            </label>

            {/* My Contacts Except */}
            <label
              onClick={() => setPrivacyType('contacts_except')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                privacyType === 'contacts_except'
                  ? 'border-brand-primary bg-brand-primary/10 shadow-sm'
                  : 'border-brand-border bg-brand-surface hover:border-brand-border-strong'
              }`}
            >
              <input
                type="radio"
                name="statusPrivacy"
                value="contacts_except"
                checked={privacyType === 'contacts_except'}
                onChange={() => setPrivacyType('contacts_except')}
                className="mt-1 text-brand-primary focus:ring-brand-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-brand-text text-sm">My Contacts Except...</span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Share with all contacts except selected people ({excludedUserIds.length} excluded).
                </p>
              </div>
            </label>

            {/* Only Share With */}
            <label
              onClick={() => setPrivacyType('only_share_with')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                privacyType === 'only_share_with'
                  ? 'border-brand-primary bg-brand-primary/10 shadow-sm'
                  : 'border-brand-border bg-brand-surface hover:border-brand-border-strong'
              }`}
            >
              <input
                type="radio"
                name="statusPrivacy"
                value="only_share_with"
                checked={privacyType === 'only_share_with'}
                onChange={() => setPrivacyType('only_share_with')}
                className="mt-1 text-brand-primary focus:ring-brand-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-brand-text text-sm">Only Share With...</span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Only show your status to selected contacts ({allowedUserIds.length} included).
                </p>
              </div>
            </label>
          </div>

          {/* Contact Selection list if not 'contacts' */}
          {privacyType !== 'contacts' && (
            <div className="pt-2 border-t border-brand-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-text">
                  {privacyType === 'contacts_except'
                    ? 'Select contacts to exclude'
                    : 'Select contacts to include'}
                </span>
                <span className="text-xs text-brand-primary font-bold">
                  {privacyType === 'contacts_except'
                    ? `${excludedUserIds.length} selected`
                    : `${allowedUserIds.length} selected`}
                </span>
              </div>

              {/* Search contacts */}
              <div className="relative">
                <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts by name or username..."
                  className="w-full bg-brand-card border border-brand-border rounded-xl pl-9 pr-4 py-2 text-brand-text placeholder-brand-muted/60 focus:outline-none focus:border-brand-primary text-xs"
                />
              </div>

              {/* Contacts list */}
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-brand-border/40">
                {isLoading ? (
                  <div className="py-8 flex justify-center items-center text-brand-muted">
                    <Loader2 className="w-5 h-5 animate-spin text-brand-primary mr-2" />
                    <span className="text-xs">Loading contacts...</span>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <p className="py-6 text-center text-xs text-brand-muted">
                    No contacts found matching your search.
                  </p>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected =
                      privacyType === 'contacts_except'
                        ? excludedUserIds.includes(contact.id)
                        : allowedUserIds.includes(contact.id);

                    return (
                      <div
                        key={contact.id}
                        onClick={() =>
                          privacyType === 'contacts_except'
                            ? handleToggleExclusion(contact.id)
                            : handleToggleAllowed(contact.id)
                        }
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={contact.profile_picture_url || contact.avatar_url}
                            name={contact.full_name || contact.username}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-semibold text-brand-text leading-tight">
                              {contact.full_name || contact.username}
                            </p>
                            <p className="text-xs text-brand-muted">@{contact.username}</p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-brand-primary border-brand-primary text-white'
                              : 'border-brand-border bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-border bg-brand-surface">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-brand-border text-brand-muted hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-violet-500/25 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Privacy</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusPrivacyModal;

