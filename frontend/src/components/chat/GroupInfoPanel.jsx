import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Crown,
  UserPlus,
  Edit2,
  Trash2,
  LogOut,
  MoreVertical,
  Check,
  AlertCircle,
  Search,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import {
  getGroupDetailsApi,
  updateGroupApi,
  addGroupMembersApi,
  removeGroupMemberApi,
  leaveGroupApi,
  updateMemberRoleApi,
  transferOwnershipApi,
  deleteGroupApi,
  searchUsers
} from '@/services/api';
import { notify } from '@/components/common/ToastProvider';

export const GroupInfoPanel = ({
  conversationId,
  currentUserId,
  onClose,
  onGroupDeleted,
  onGroupLeft
}) => {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Add members state
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  // Transfer ownership confirmation state
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferring, setTransferring] = useState(false);

  // Member action menu state
  const [activeMenuMemberId, setActiveMenuMemberId] = useState(null);

  // Load group details
  const fetchGroupDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getGroupDetailsApi(conversationId);
      if (res.success && res.group) {
        setGroup(res.group);
        setEditName(res.group.name || '');
        setEditDescription(res.group.description || '');
      }
    } catch (err) {
      console.error('[GroupInfoPanel] Failed to load details:', err);
      notify.error('Could not load group details');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  // Debounced search for Add Members
  useEffect(() => {
    if (!showAddMembers) return;
    if (!addSearchQuery.trim()) {
      setAddSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(addSearchQuery.trim(), 1, 15);
        if (res.success) {
          // Filter out users who are already in the group
          const existingIds = new Set((group?.members || []).map((m) => m.id || m.user_id));
          const filtered = (res.users || []).filter((u) => !existingIds.has(u.id));
          setAddSearchResults(filtered);
        }
      } catch (err) {
        console.error('[GroupInfoPanel] Search error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [addSearchQuery, showAddMembers, group]);

  const myRole = group?.my_role || 'member';
  const isCreator = myRole === 'creator';
  const isAdmin = myRole === 'admin' || isCreator;

  // Save Group Info
  const handleSaveInfo = async () => {
    if (!editName.trim() || editName.trim().length < 3) {
      notify.error('Group name must be at least 3 characters');
      return;
    }

    try {
      setSavingInfo(true);
      const res = await updateGroupApi(group.id, {
        name: editName.trim(),
        description: editDescription.trim()
      });
      if (res.success) {
        notify.success('Group information updated');
        setIsEditingInfo(false);
        fetchGroupDetails();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update group information');
    } finally {
      setSavingInfo(false);
    }
  };

  // Add Members Submission
  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.length === 0) return;
    try {
      setAddingMembers(true);
      const memberIds = selectedNewMembers.map((m) => m.id);
      const res = await addGroupMembersApi(group.id, memberIds);
      if (res.success) {
        notify.success(`Added ${selectedNewMembers.length} member(s)`);
        setShowAddMembers(false);
        setSelectedNewMembers([]);
        setAddSearchQuery('');
        fetchGroupDetails();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUserId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;
    try {
      const res = await removeGroupMemberApi(group.id, targetUserId);
      if (res.success) {
        notify.success(`${memberName} was removed from the group`);
        setActiveMenuMemberId(null);
        fetchGroupDetails();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to remove member');
    }
  };

  // Promote / Demote Role
  const handleRoleChange = async (targetUserId, newRole, memberName) => {
    try {
      const res = await updateMemberRoleApi(group.id, targetUserId, newRole);
      if (res.success) {
        notify.success(`${memberName} is now a group ${newRole}`);
        setActiveMenuMemberId(null);
        fetchGroupDetails();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to update member role');
    }
  };

  // Transfer Ownership
  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    try {
      setTransferring(true);
      const res = await transferOwnershipApi(group.id, transferTarget.id);
      if (res.success) {
        notify.success(`Ownership transferred to ${transferTarget.full_name || transferTarget.username}`);
        setTransferTarget(null);
        setActiveMenuMemberId(null);
        fetchGroupDetails();
      }
    } catch (err) {
      notify.error(err.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      const res = await leaveGroupApi(group.id);
      if (res.success) {
        notify.success('You have left the group');
        onClose();
        onGroupLeft?.(conversationId);
      }
    } catch (err) {
      notify.error(err.message || 'Failed to leave group');
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!window.confirm('DANGER: Are you sure you want to delete this group permanently for everyone? This cannot be undone.')) return;
    try {
      const res = await deleteGroupApi(group.id);
      if (res.success) {
        notify.success('Group deleted successfully');
        onClose();
        onGroupDeleted?.(conversationId);
      }
    } catch (err) {
      notify.error(err.message || 'Failed to delete group');
    }
  };

  return (
    <>
      {/* Mobile/Tablet Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden"
        onClick={onClose}
      />

      <div className="fixed xl:static inset-y-0 right-0 z-50 xl:z-20 w-full sm:w-80 lg:w-96 h-full bg-brand-surface border-l border-brand-border flex flex-col shadow-2xl xl:shadow-glass animate-slide-left shrink-0 transition-colors duration-200">
        {/* Header */}
      <div className="h-16 px-4 border-b border-brand-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-primary" />
          <span>Group Information</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
        </div>
      ) : group ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Group Identity Card */}
          <div className="flex flex-col items-center text-center p-4 bg-brand-card border border-brand-border/60 rounded-2xl relative">
            {isAdmin && !isEditingInfo && (
              <button
                onClick={() => setIsEditingInfo(true)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Edit Group Info"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="relative mb-3">
              <Avatar
                name={group.name}
                src={group.profile_image}
                size="xl"
                shape="rounded"
              />
            </div>

            {isEditingInfo ? (
              <div className="w-full space-y-3 mt-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={150}
                  placeholder="Group Name"
                  className="w-full px-3 py-1.5 text-xs bg-brand-bg text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-1.5 text-xs bg-brand-bg text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary/60 resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setIsEditingInfo(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={handleSaveInfo}
                    isLoading={savingInfo}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="text-base font-bold text-white tracking-tight">{group.name}</h4>
                {group.description && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed max-w-xs">{group.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2.5 text-[11px] text-brand-subtle">
                  <span>{group.members_count} members</span>
                  <span>•</span>
                  <span className="text-brand-secondary font-medium">{group.online_count} online</span>
                </div>
              </>
            )}
          </div>

          {/* Members Section Header & Add Member Button */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white tracking-wide uppercase">
                Members ({group.members?.length || 0})
              </h5>

              {isAdmin && (
                <button
                  onClick={() => setShowAddMembers((prev) => !prev)}
                  className="text-xs text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 font-semibold transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Members</span>
                </button>
              )}
            </div>

            {/* Collapsible Add Member Input & Results */}
            {showAddMembers && (
              <div className="p-3 bg-brand-card border border-brand-border rounded-xl space-y-2 animate-fade-in">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-subtle" />
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    placeholder="Search users to add..."
                    className="w-full pl-8 pr-3 py-1 text-xs bg-brand-bg text-brand-text rounded-lg border border-brand-border focus:outline-none focus:border-brand-primary/60"
                  />
                </div>

                {selectedNewMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedNewMembers.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-primary/20 text-[10px] text-brand-text"
                      >
                        {m.full_name || `@${m.username}`}
                        <X
                          className="w-3 h-3 cursor-pointer text-brand-subtle hover:text-brand-text"
                          onClick={() => setSelectedNewMembers((prev) => prev.filter((u) => u.id !== m.id))}
                        />
                      </span>
                    ))}
                  </div>
                )}

                {addSearchResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-brand-border/30 rounded-lg border border-brand-border/40">
                    {addSearchResults.map((u) => {
                      const isSel = selectedNewMembers.some((m) => m.id === u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isSel) {
                              setSelectedNewMembers((prev) => prev.filter((m) => m.id !== u.id));
                            } else {
                              setSelectedNewMembers((prev) => [...prev, u]);
                            }
                          }}
                          className={`p-1.5 flex items-center justify-between cursor-pointer text-xs ${
                            isSel ? 'bg-brand-primary/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={u.full_name} src={u.profile_picture} size="xs" shape="rounded" />
                            <span className="truncate text-brand-text">{u.full_name || `@${u.username}`}</span>
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-brand-primary" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedNewMembers.length > 0 && (
                  <Button
                    size="xs"
                    variant="primary"
                    className="w-full mt-1"
                    onClick={handleAddMembersSubmit}
                    isLoading={addingMembers}
                  >
                    Confirm Add ({selectedNewMembers.length})
                  </Button>
                )}
              </div>
            )}

            {/* Members List */}
            <div className="space-y-1.5">
              {(group.members || []).map((m) => {
                const isTargetSelf = m.id === currentUserId;
                const isTargetCreator = m.role === 'creator';
                const isTargetAdmin = m.role === 'admin';

                // Determine if actor can manage this member
                let canManage = false;
                if (!isTargetSelf) {
                  if (isCreator) canManage = true;
                  else if (isAdmin && m.role === 'member') canManage = true;
                }

                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-brand-card/50 border border-brand-border/40 flex items-center justify-between hover:bg-brand-card transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={m.full_name}
                        src={m.profile_picture}
                        size="sm"
                        shape="rounded"
                        status={m.is_online ? 'online' : null}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-brand-text truncate">
                            {m.full_name || `@${m.username}`}
                          </p>
                          {isTargetSelf && (
                            <span className="text-[10px] text-brand-subtle font-normal">(You)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-brand-subtle truncate">@{m.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role Badge */}
                      {isTargetCreator ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                          <Crown className="w-2.5 h-2.5" />
                          Creator
                        </span>
                      ) : isTargetAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-[10px] text-brand-subtle px-1">Member</span>
                      )}

                      {/* Options menu for privileged actions */}
                      {canManage && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuMemberId(activeMenuMemberId === m.id ? null : m.id)
                            }
                            className="p-1 rounded-lg text-brand-subtle hover:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeMenuMemberId === m.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-44 bg-brand-surface border border-brand-border rounded-xl shadow-elevated py-1 z-30 animate-fade-in"
                              onMouseLeave={() => setActiveMenuMemberId(null)}
                            >
                              {/* Creator: Promote / Demote */}
                              {isCreator && (
                                <>
                                  {isTargetAdmin ? (
                                    <button
                                      onClick={() => handleRoleChange(m.id, 'member', m.full_name || m.username)}
                                      className="w-full px-3 py-1.5 text-xs text-left text-brand-text hover:bg-white/5 flex items-center gap-2"
                                    >
                                      <Shield className="w-3.5 h-3.5 text-brand-subtle" />
                                      <span>Demote to Member</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRoleChange(m.id, 'admin', m.full_name || m.username)}
                                      className="w-full px-3 py-1.5 text-xs text-left text-brand-primary hover:bg-brand-primary/10 flex items-center gap-2"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                                      <span>Promote to Admin</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setActiveMenuMemberId(null);
                                      setTransferTarget(m);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-left text-amber-400 hover:bg-amber-400/10 flex items-center gap-2"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Transfer Ownership</span>
                                  </button>
                                </>
                              )}

                              {/* Remove Member */}
                              <button
                                onClick={() => handleRemoveMember(m.id, m.full_name || m.username)}
                                className="w-full px-3 py-1.5 text-xs text-left text-brand-danger hover:bg-brand-danger/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-brand-danger" />
                                <span>Remove from Group</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transfer Ownership Modal Dialog */}
          {transferTarget && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Crown className="w-4 h-4" />
                <span>Transfer Group Ownership?</span>
              </div>
              <p className="text-[11px] text-brand-muted leading-relaxed">
                You are about to transfer creator ownership of this group to{' '}
                <strong className="text-white">{transferTarget.full_name || transferTarget.username}</strong>. You will
                become a regular admin.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button size="xs" variant="ghost" onClick={() => setTransferTarget(null)}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  variant="primary"
                  className="bg-amber-500 hover:bg-amber-600 border-none"
                  onClick={handleTransferOwnership}
                  isLoading={transferring}
                >
                  Confirm Transfer
                </Button>
              </div>
            </div>
          )}

          {/* Danger Zone Actions */}
          <div className="pt-4 border-t border-brand-border/60 space-y-2">
            <button
              onClick={handleLeaveGroup}
              className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border/60 text-xs font-medium text-brand-muted hover:text-white hover:bg-white/5 flex items-center justify-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4 text-brand-subtle" />
              <span>Leave Group</span>
            </button>

            {isCreator && (
              <button
                onClick={handleDeleteGroup}
                className="w-full px-3.5 py-2.5 rounded-xl border border-brand-danger/30 text-xs font-medium text-brand-danger bg-brand-danger/5 hover:bg-brand-danger/15 flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4 text-brand-danger" />
                <span>Delete Group for Everyone</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-brand-subtle">Group details unavailable</div>
      )}
      </div>
    </>
  );
};

export default GroupInfoPanel;

