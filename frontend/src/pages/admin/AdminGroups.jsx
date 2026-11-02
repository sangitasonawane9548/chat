import React, { useState, useEffect } from 'react';
import { FolderGit2, Users, Radio, Trash2, Shield, Search, RefreshCw, Sparkles } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Button from '@/components/ui/Button';
import { getAdminGroups, deleteAdminGroup, updateAdminGroupStatus } from '@/services/adminApi';
import { notify } from '@/components/common/ToastProvider';

export const AdminGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await getAdminGroups();
      if (res.success) setGroups(res.groups);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDeleteGroup = async (groupId, name) => {
    if (!window.confirm(`Are you sure you want to administratively disband "${name}"?`)) return;
    try {
      await deleteAdminGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      notify.success(`Group "${name}" has been disbanded.`);
    } catch (err) {
      notify.error(err.message || 'Failed to disband group');
    }
  };

  const handleToggleGroupStatus = async (group) => {
    const nextStatus = group.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateAdminGroupStatus(group.id, nextStatus, 'Admin console toggle');
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, status: nextStatus } : g))
      );
      notify.info(`Group "${group.name}" is now ${nextStatus}.`);
    } catch (err) {
      notify.error(err.message || 'Failed to update group status');
    }
  };

  const filtered = groups.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q) || g.creator_username.toLowerCase().includes(q);
  });

  const columns = [
    {
      header: 'Group Identity',
      render: (g) => (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary/20 to-purple-600/20 border border-brand-primary/40 flex items-center justify-center text-brand-primary shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate text-xs">{g.name}</p>
            <p className="text-[11px] text-brand-muted truncate max-w-[220px]">{g.description}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Creator',
      render: (g) => (
        <span className="text-brand-secondary font-medium text-xs">@{g.creator_username}</span>
      )
    },
    {
      header: 'Members',
      render: (g) => (
        <span className="font-semibold text-white text-xs">{g.members_count} members</span>
      )
    },
    {
      header: 'Live Status',
      render: (g) => (
        g.active_call ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-primary/20 text-brand-primary border border-brand-primary/40">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Call Active</span>
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-brand-muted border border-white/10">
            Idle
          </span>
        )
      )
    },
    {
      header: 'Created',
      render: (g) => (
        <span className="text-brand-subtle text-[11px]">
          {new Date(g.created_at).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Group Status',
      render: (g) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          g.status === 'suspended' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          {g.status || 'active'}
        </span>
      )
    },
    {
      header: 'Actions',
      render: (g) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToggleGroupStatus(g)}
            className={`p-1.5 rounded-lg transition-colors ${
              g.status === 'suspended'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
            title={g.status === 'suspended' ? 'Reactivate Group' : 'Suspend Group'}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteGroup(g.id, g.name)}
            className="p-1.5 rounded-lg text-brand-subtle hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
            title="Administrative Group Override (Disband)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Group Chat Management</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
              {groups.length} Channels
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Oversee collaborative group spaces, active WebRTC conferences, and membership distribution
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchGroups}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search groups by title, creator, description..."
        emptyMessage="No groups matching search query"
      />
    </PageTransition>
  );
};

export default AdminGroups;

