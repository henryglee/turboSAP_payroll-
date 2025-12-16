/**
 * AdminUsersPage - User management page for admins
 * View all users, create new users, and see user progress (visual filler)
 */

import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { useAuthStore } from '../store/auth';
import { apiFetch } from '../api/utils';
import { resetUserPassword } from '../api/auth';
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
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: string;
  companyName?: string;
  createdAt?: string;
  lastLogin?: string;
}

interface UserSession {
  id: string;
  module: string;
  updatedAt: string;
  progress: number;
  done: boolean;
  payrollAreas?: any[];
  paymentMethods?: any[];
}

interface UserProgress {
  payrollArea: 'not-started' | 'in-progress' | 'completed';
  paymentMethod: 'not-started' | 'in-progress' | 'completed';
  lastActivity?: string;
}

export function AdminUsersPage() {
  useAuthStore(); // Auth check
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordMessage, setResetPasswordMessage] = useState<string | null>(null);
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

  // Load sessions when a client user is selected
  useEffect(() => {
    if (selectedUser && selectedUser.role === 'client') {
      loadUserSessions(selectedUser.id);
    } else {
      setUserSessions([]);
    }
  }, [selectedUser]);

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      // SQLite TIMESTAMP format: "YYYY-MM-DD HH:MM:SS" (UTC time stored in database)
      // Parse it as UTC and convert to local time for display
      let date: Date;
      
      // Check if it's in SQLite format (YYYY-MM-DD HH:MM:SS)
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
        // SQLite CURRENT_TIMESTAMP returns UTC time
        // Convert "2025-12-16 19:27:55" to ISO format with UTC indicator
        const utcString = dateString.replace(' ', 'T') + 'Z';
        date = new Date(utcString);
      } else if (dateString.includes('T') || dateString.includes('Z')) {
        // ISO format or already has timezone info
        date = new Date(dateString);
      } else {
        // Fallback: try parsing as-is
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return dateString;
      }
      
      // Format: "Dec 16, 2024 11:27 AM" (converted to browser's local timezone)
      // This automatically converts from UTC to local time
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
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

  const loadUserSessions = async (userId: number) => {
    if (!userId) return;
    setLoadingSessions(true);
    try {
      const data = await apiFetch<{ sessions: UserSession[] }>(`/api/admin/users/${userId}/sessions`);
      setUserSessions(data.sessions || []);
    } catch (err: any) {
      console.error('Failed to load user sessions:', err);
      setUserSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const getUserProgress = (): UserProgress => {
    if (!selectedUser || selectedUser.role !== 'client') {
      return { payrollArea: 'not-started', paymentMethod: 'not-started' };
    }

    const payrollAreaSessions = userSessions.filter(s => s.module === 'payroll area');
    const paymentMethodSessions = userSessions.filter(s => s.module === 'payment method');

    // Check payroll area status
    let payrollAreaStatus: 'not-started' | 'in-progress' | 'completed' = 'not-started';
    const completedPayrollArea = payrollAreaSessions.find(s => s.done && s.payrollAreas && s.payrollAreas.length > 0);
    const inProgressPayrollArea = payrollAreaSessions.find(s => !s.done && s.progress > 0);
    if (completedPayrollArea) {
      payrollAreaStatus = 'completed';
    } else if (inProgressPayrollArea || payrollAreaSessions.length > 0) {
      payrollAreaStatus = 'in-progress';
    }

    // Check payment method status
    let paymentMethodStatus: 'not-started' | 'in-progress' | 'completed' = 'not-started';
    const completedPaymentMethod = paymentMethodSessions.find(s => s.done && s.paymentMethods && s.paymentMethods.length > 0);
    const inProgressPaymentMethod = paymentMethodSessions.find(s => !s.done && s.progress > 0);
    if (completedPaymentMethod) {
      paymentMethodStatus = 'completed';
    } else if (inProgressPaymentMethod || paymentMethodSessions.length > 0) {
      paymentMethodStatus = 'in-progress';
    }

    // Get last activity
    const allSessions = [...payrollAreaSessions, ...paymentMethodSessions];
    const lastSession = allSessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    
    let lastActivity = 'Never';
    if (lastSession) {
      const lastDate = new Date(lastSession.updatedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) {
        lastActivity = 'Just now';
      } else if (diffMins < 60) {
        lastActivity = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        lastActivity = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        lastActivity = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else {
        lastActivity = formatDate(lastSession.updatedAt);
      }
    }

    return {
      payrollArea: payrollAreaStatus,
      paymentMethod: paymentMethodStatus,
      lastActivity,
    };
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setResetPasswordError(null);
    setResetPasswordMessage(null);

    // Validation
    if (!resetPasswordForm.newPassword || !resetPasswordForm.confirmPassword) {
      setResetPasswordError('All fields are required');
      return;
    }

    if (resetPasswordForm.newPassword.length < 6) {
      setResetPasswordError('Password must be at least 6 characters');
      return;
    }

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setResetPasswordError('Passwords do not match');
      return;
    }

    setResetting(true);
    try {
      await resetUserPassword(selectedUser.id, {
        newPassword: resetPasswordForm.newPassword,
      });
      setResetPasswordMessage('Password reset successfully');
      setResetPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowResetPassword(false);
        setResetPasswordMessage(null);
      }, 2000);
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
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
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">User</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Company</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Created</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Last Login</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground font-mono">#{u.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-foreground">
                          {u.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-foreground">{u.companyName || 'No company'}</span>
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(u.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {formatDate(u.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                        }}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
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
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Add New User</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter username"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newUser.companyName}
                  onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value="Client"
                  disabled
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-colors"
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
            onClick={() => {
              setSelectedUser(null);
              setUserSessions([]);
            }}
          />
          <div className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto shadow-xl">
            {/* Panel Header */}
            <div className="sticky top-0 bg-card border-b border-border p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">User Details</h2>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setUserSessions([]);
                  }}
                  className="p-1 hover:bg-secondary rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center text-xl font-medium text-foreground">
                  {selectedUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">{selectedUser.username}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.companyName || 'No company'}</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-2 ${
                    selectedUser.role === 'admin'
                      ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
                      : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Configuration Progress - Only show for client users */}
              {selectedUser && selectedUser.role === 'client' ? (
                <div className="border-t border-border pt-6 mt-6">
                  <h3 className="text-sm font-medium text-foreground mb-4">Configuration Progress</h3>
                  {loadingSessions ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Loading progress...
                    </div>
                  ) : (
                    (() => {
                      const progress = getUserProgress();
                      console.log('Debug - selectedUser:', selectedUser);
                      console.log('Debug - userSessions:', userSessions);
                      console.log('Debug - progress:', progress);
                      return (
                        <div className="space-y-3">
                          {/* Payroll Area Progress */}
                          <div className="bg-secondary rounded-lg p-4 border border-border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-50">
                                <Calendar className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">Payroll Areas</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusIcon(progress.payrollArea)}
                                  <span className="text-xs text-muted-foreground">
                                    {getStatusText(progress.payrollArea)}
                                  </span>
                                  {progress.payrollArea === 'completed' && (
                                    <span className="text-xs text-muted-foreground">
                                      ({userSessions
                                        .filter(s => s.module === 'payroll area' && s.done && s.payrollAreas)
                                        .reduce((sum, s) => sum + (s.payrollAreas?.length || 0), 0)} areas)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Payment Method Progress */}
                          <div className="bg-secondary rounded-lg p-4 border border-border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-50">
                                <CreditCard className="h-4 w-4 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">Payment Methods</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {getStatusIcon(progress.paymentMethod)}
                                  <span className="text-xs text-muted-foreground">
                                    {getStatusText(progress.paymentMethod)}
                                  </span>
                                  {progress.paymentMethod === 'completed' && (
                                    <span className="text-xs text-muted-foreground">
                                      ({userSessions
                                        .filter(s => s.module === 'payment method' && s.done && s.paymentMethods)
                                        .reduce((sum, s) => sum + (s.paymentMethods?.length || 0), 0)} methods)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Last Activity */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <Clock className="h-3 w-3" />
                            <span>Last activity: {progress.lastActivity || 'Never'}</span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              ) : selectedUser && selectedUser.role === 'admin' ? (
                <div className="border-t border-border pt-6 mt-6">
                  <p className="text-sm text-muted-foreground">Configuration progress is only available for client users.</p>
                </div>
              ) : null}

              {/* Actions */}
              <div className="pt-4 border-t border-border space-y-3">
                <button
                  onClick={() => {
                    setShowResetPassword(true);
                    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
                    setResetPasswordError(null);
                    setResetPasswordMessage(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
                >
                  <Lock className="h-4 w-4" />
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setResetPasswordForm({ newPassword: '', confirmPassword: '' });
                  setResetPasswordError(null);
                  setResetPasswordMessage(null);
                }}
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Reset password for user: <strong className="text-foreground">{selectedUser.username}</strong>
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetPasswordError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{resetPasswordError}</span>
                  <button
                    type="button"
                    onClick={() => setResetPasswordError(null)}
                    className="ml-auto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {resetPasswordMessage && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{resetPasswordMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
                    setResetPasswordError(null);
                    setResetPasswordMessage(null);
                  }}
                  className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-lg transition-colors"
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
