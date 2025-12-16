/**
 * Admin management page.
 * Only accessible to admin users.
 * Allows viewing and managing users.
 * 
 * Note: UI focus is on client users, not admin. Admins can also:
 * - Edit JSON/configuration files directly
 * - Use API endpoints (POST /api/admin/users, etc.)
 * - Use scripts (create_admin.py)
 * This UI is functional but admin-friendly polish is lower priority.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { apiFetch } from '../api/utils';
import { AdminLayout } from '../components/layout/AdminLayout';
import { formatDateTime } from '../lib/utils';

interface User {
  id: number;
  username: string;
  role: string;
  companyName?: string;
  createdAt?: string;
  lastLogin?: string;
}

export function AdminPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'client' as 'client' | 'admin',
    companyName: '',
  });
  const [creating, setCreating] = useState(false);

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <AdminLayout title="User Management" description="Access denied">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">This page is only available to administrators.</p>
        </div>
      </AdminLayout>
    );
  }

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ users: User[] }>('/api/admin/users');
      console.log('Loaded users:', data);
      if (data && data.users) {
        setUsers(data.users);
      } else {
        console.error('Invalid response format:', data);
        setError('Invalid response from server');
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Use centralized date formatting utility for consistent, precise time display
  const formatDate = (dateString?: string) => {
    return formatDateTime(dateString, { format: 'full' });
  };

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
    setError(null);
    try {
      // Check if user is admin before making request
      if (user?.role !== 'admin') {
        setError('Only administrators can create users');
        setCreating(false);
        return;
      }

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
          role: 'client', // Always create client users
          companyName: newUser.companyName || undefined,
        }),
      });
      setMessage(`User "${response.username}" created successfully`);
      setError(null);
      setNewUser({ username: '', password: '', role: 'client', companyName: '' });
      setShowAddUserForm(false);
      // Reload users list immediately after successful creation
      await loadUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      const errorMessage = err.message || 'Failed to create user';
      
      // Provide more helpful error messages
      if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
        setError('Your session has expired. Please log out and log in again as an administrator.');
      } else if (errorMessage.includes('403') || errorMessage.includes('Admin access required')) {
        setError('Only administrators can create users. Please ensure you are logged in as an admin.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminLayout
      title="User Management"
      description="Manage users and their roles. You can create new users with different roles."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-6">
            <button
              className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
              onClick={() => setShowAddUserForm(!showAddUserForm)}
            >
              {showAddUserForm ? 'Cancel' : 'Add User'}
            </button>
          </div>

          {showAddUserForm && (
            <div className="mb-8 p-8 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-gray-900 border-b border-gray-200 pb-3">
                Create New User
              </h3>
              <form onSubmit={handleCreateUser}>
                <div className="grid grid-cols-2 gap-5 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                      value="Client"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                      value={newUser.companyName}
                      onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
                {error && showAddUserForm && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </form>
            </div>
          )}

          {error && showAddUserForm && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">{message}</p>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Users List</h2>
          </div>

          {error && !showAddUserForm && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">ID</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Username</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Created</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{u.id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
                              : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{u.companyName || '-'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.createdAt as string)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.lastLogin as string)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

