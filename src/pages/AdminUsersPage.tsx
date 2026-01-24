/**
 * AdminUsersPage - User management page for admins
 * View all users, create new users, and see user progress (visual filler)
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { useAuthStore } from '../store/auth';
import { apiFetch } from '../api/utils';
import {
  UserPlus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  X,
  ChevronRight,
  CreditCard,
  Lock,
  KeyRound,
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: string;
  companyName?: string;
  createdAt?: string;
  lastLogin?: string;
}

interface UserProgress {
  payrollArea: 'not-started' | 'in-progress' | 'completed';
  paymentMethod: 'not-started' | 'in-progress' | 'completed';
  lastActivity?: string;
}

export function AdminUsersPage() {
  useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProgress, setUserProgress] = useState<Record<number, UserProgress>>({});

  // Add user form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    companyName: '',
  });
  const [creating, setCreating] = useState(false);

  // User detail panel state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Reset password modal state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ users: User[] }>('/api/admin/users');
      if (data && data.users) {
        setUsers(data.users);
      } else {
        setError('Invalid response from server');
        setUsers([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!newUser.username || !newUser.password) {
      setError('Username and password are required');
      return;
    }

    if (newUser.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setCreating(true);
    try {
      const response = await apiFetch<{
        userId: number;
        username: string;
        role: string;
        companyName?: string;
      }>('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: 'client',
          companyName: newUser.companyName || undefined,
        }),
      });
      setMessage(`User "${response.username}" created successfully`);
      setNewUser({ username: '', password: '', companyName: '' });
      setShowAddForm(false);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!resetPasswordForm.newPassword) {
      setError('New password is required');
      return;
    }

    if (resetPasswordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!selectedUser) return;

    setResetting(true);
    try {
      const response = await apiFetch<{ status: string; message: string }>(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: resetPasswordForm.newPassword }),
        }
      );
      setMessage(response.message || `Password reset successfully for user "${selectedUser.username}"`);
      setResetPasswordForm({ newPassword: '', confirmPassword: '' });
      setShowResetPassword(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const loadUserProgress = async (userId: number) => {
    try {
      const data = await apiFetch<UserProgress>(`/api/admin/users/${userId}/progress`);
      setUserProgress(prev => ({ ...prev, [userId]: data }));
    } catch (err) {
      console.error('Failed to load user progress:', err);
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in-progress':
        return <Circle className="h-4 w-4 text-amber-500 fill-amber-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.companyName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AdminLayout
      title="User Management"
      description="View and manage platform users"
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
          />
        </div>

        {/* Add User Button */}
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-red-500 hover:text-red-700" />
          </button>
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-sm text-green-700">{message}</p>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="h-4 w-4 text-green-500 hover:text-green-700" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Created</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Last Login</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.username}</p>
                          <p className="text-sm text-gray-500">{u.companyName || 'No company'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
                          : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {formatDateTime(u.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {formatDateTime(u.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          loadUserProgress(u.id);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        View Details
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Add New User</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter username"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newUser.companyName}
                  onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value="Client"
                  disabled
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Detail Slide-out Panel */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedUser(null)}
          />
          <div className="relative w-full max-w-md bg-white border-l border-gray-200 h-full overflow-y-auto shadow-xl">
            {/* Panel Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">User Details</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center text-xl font-medium text-gray-600">
                  {selectedUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-900">{selectedUser.username}</p>
                  <p className="text-sm text-gray-500">{selectedUser.companyName || 'No company'}</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-2 ${
                    selectedUser.role === 'admin'
                      ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
                      : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">User ID</span>
                  <span className="text-sm text-gray-900">#{selectedUser.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Created</span>
                  <span className="text-sm text-gray-900">{formatDateTime(selectedUser.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Login</span>
                  <span className="text-sm text-gray-900">{formatDateTime(selectedUser.lastLogin)}</span>
                </div>
              </div>

              {/* Configuration Progress (Visual Filler) */}
              {selectedUser.role === 'client' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Configuration Progress</h3>
                  <div className="space-y-3">
                    {/* Payroll Area Progress */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50">
                          <Calendar className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Payroll Areas</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(userProgress[selectedUser.id]?.payrollArea || 'not-started')}
                            <span className="text-xs text-gray-500">
                              {getStatusText(userProgress[selectedUser.id]?.payrollArea || 'not-started')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Method Progress */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-50">
                          <CreditCard className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Payment Methods</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(userProgress[selectedUser.id]?.paymentMethod || 'not-started')}
                            <span className="text-xs text-gray-500">
                              {getStatusText(userProgress[selectedUser.id]?.paymentMethod || 'not-started')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <Clock className="h-3 w-3" />
                      <span>Last activity: {formatDateTime(userProgress[selectedUser.id]?.lastActivity)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Actions</h3>
                <button
                  onClick={() => setShowResetPassword(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
              </div>
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setResetPasswordForm({ newPassword: '', confirmPassword: '' });
                  setError(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Resetting password for user: <strong>{selectedUser.username}</strong>
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>Note:</strong> The system does not support viewing or recovering old passwords. 
                  This will set a new temporary password for the user.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
                >
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
