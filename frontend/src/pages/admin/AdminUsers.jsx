import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Shield, UserX, UserCheck, Edit3, MoreHorizontal, Check, RefreshCw } from 'lucide-react';
import PageTransition from '@/components/common/PageTransition';
import AdminDataTable from '@/components/admin/AdminDataTable';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { getAdminUsers, updateAdminUserStatus, updateAdminUserRole, deleteAdminUser } from '@/services/adminApi';
import { notify } from '@/components/common/ToastProvider';

export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // User Edit Modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editRole, setEditRole] = useState('user');
  const [editStatus, setEditStatus] = useState('active');

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const res = await getAdminUsers({
        search,
        role: roleFilter,
        status: statusFilter,
        page,
        limit: 10
      });
      if (res.success) {
        setUsers(res.users);
        setPagination(res.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditRole(user.role || 'user');
    setEditStatus(user.account_status || 'active');
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      if (editStatus !== selectedUser.account_status) {
        await updateAdminUserStatus(selectedUser.id, editStatus, 'Admin console edit');
      }
      if (editRole !== selectedUser.role) {
        await updateAdminUserRole(selectedUser.id, editRole);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, role: editRole, account_status: editStatus }
            : u
        )
      );
      notify.success(`User @${selectedUser.username} permissions updated.`);
      setSelectedUser(null);
    } catch (err) {
      notify.error(err.message || 'Failed to update user');
    }
  };

  const handleToggleSuspend = async (user) => {
    const newStatus = user.account_status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateAdminUserStatus(user.id, newStatus, 'Status toggle');
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, account_status: newStatus } : u))
      );
      notify.info(`User @${user.username} marked as ${newStatus}.`);
    } catch (err) {
      notify.error(err.message || 'Failed to change status');
    }
  };

  const columns = [
    {
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3 min-w-[180px]">
          <Avatar name={u.full_name} src={u.profile_picture} size="sm" shape="rounded" status={u.is_online ? 'online' : null} />
          <div className="min-w-0">
            <p className="font-semibold text-white truncate text-xs">{u.full_name}</p>
            <p className="text-[11px] text-brand-secondary truncate font-medium">@{u.username}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Email',
      render: (u) => (
        <span className="text-brand-muted truncate max-w-[180px] block font-mono text-[11px]">
          {u.email}
        </span>
      )
    },
    {
      header: 'Role',
      render: (u) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          u.role === 'admin'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : u.role === 'moderator'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
            : u.role === 'support'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
            : 'bg-white/10 text-brand-muted border border-white/15'
        }`}>
          {u.role || 'user'}
        </span>
      )
    },
    {
      header: 'Status',
      render: (u) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          u.account_status === 'active'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : u.account_status === 'suspended'
            ? 'bg-brand-danger/15 text-brand-danger border border-brand-danger/30'
            : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
        }`}>
          {u.account_status || 'active'}
        </span>
      )
    },
    {
      header: 'Registered',
      render: (u) => (
        <span className="text-brand-subtle text-[11px]">
          {new Date(u.created_at || Date.now()).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Actions',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEdit(u)}
            className="p-1.5 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
            title="Edit Role & Permissions"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToggleSuspend(u)}
            className={`p-1.5 rounded-lg transition-colors ${
              u.account_status === 'suspended'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-brand-danger hover:bg-brand-danger/10'
            }`}
            title={u.account_status === 'suspended' ? 'Reactivate Account' : 'Suspend Account'}
          >
            {u.account_status === 'suspended' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
          </button>
        </div>
      )
    }
  ];

  return (
    <PageTransition className="space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>User Accounts & RBAC</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {pagination.total} Accounts
            </span>
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Directory of registered @usernames, role-based access, and account suspensions
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchUsers(pagination.page)}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 border border-brand-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Role Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs shrink-0">
          <span className="text-[11px] font-semibold text-brand-subtle mr-1">Role:</span>
          {['all', 'admin', 'moderator', 'support', 'user'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-xl capitalize font-medium transition-colors ${
                roleFilter === r
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs self-end sm:self-auto shrink-0">
          <span className="text-[11px] font-semibold text-brand-subtle mr-1">Status:</span>
          {['all', 'active', 'suspended'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-xl capitalize font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-brand-primary text-white font-bold'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <AdminDataTable
        columns={columns}
        data={users}
        loading={loading}
        pagination={pagination}
        onPageChange={(p) => fetchUsers(p)}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by @username, name, email..."
        emptyMessage="No users matching current filters"
      />

      {/* Edit Role Modal */}
      {selectedUser && (
        <Modal
          isOpen={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          title={`Edit Account: @${selectedUser.username}`}
          description={`Update role privileges and account standing for ${selectedUser.full_name}`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5">
                Role Assignment
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
              >
                <option value="user">Standard User</option>
                <option value="moderator">Moderator (Reports & Content)</option>
                <option value="support">Support Agent</option>
                <option value="admin">Platform Administrator (Root)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5">
                Account Standing
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-surface text-brand-text rounded-xl border border-brand-border focus:outline-none focus:border-brand-primary"
              >
                <option value="active">Active (Full Access)</option>
                <option value="pending">Pending Verification</option>
                <option value="suspended">Suspended (Restricted)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-brand-border flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveUser} className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageTransition>
  );
};

export default AdminUsers;

