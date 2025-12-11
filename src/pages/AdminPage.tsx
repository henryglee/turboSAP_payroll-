/**
 * Admin management page.
 * Only accessible to admin users.
 * Allows viewing and managing users.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { apiFetch } from '../api/utils';
import './AdminPage.css';

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
      <main className="main-container">
        <div className="right-panel">
          <div className="section">
            <div className="admin-access-denied">
              <h2>Access Denied</h2>
              <p>This page is only available to administrators.</p>
            </div>
          </div>
        </div>
      </main>
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
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
    <main className="main-container">
      <div className="left-panel">
        <div className="section">
          <div style={{ marginBottom: '2rem' }}>
            <h2 className="section-title">User Management</h2>
            <p style={{ marginTop: '0.5rem', color: '#718096', fontSize: '0.9375rem', lineHeight: '1.6' }}>
              Manage users and their roles. You can create new users with different roles.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <button
              className="button"
              onClick={() => setShowAddUserForm(!showAddUserForm)}
              style={{ width: '100%' }}
            >
              {showAddUserForm ? 'Cancel' : 'Add User'}
            </button>
          </div>

          {showAddUserForm && (
            <div style={{
              marginBottom: '2rem',
              padding: '2rem',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ 
                marginBottom: '1.5rem', 
                fontSize: '1.125rem', 
                fontWeight: 600,
                color: '#111827',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '0.75rem'
              }}>
                Create New User
              </h3>
              <form onSubmit={handleCreateUser}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '1.25rem', 
                  marginBottom: '1.5rem' 
                }}>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      required
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <input
                      type="text"
                      className="form-input"
                      value="Client"
                      disabled
                      style={{ 
                        background: '#f3f4f6', 
                        color: '#6b7280', 
                        cursor: 'not-allowed' 
                      }}
                    />
                    <input
                      type="hidden"
                      value="client"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newUser.companyName}
                      onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="submit"
                    className="button"
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
                {error && showAddUserForm && (
                  <div className="admin-message error" style={{ marginTop: '1rem', marginBottom: 0 }}>
                    {error}
                  </div>
                )}
              </form>
            </div>
          )}

          {error && showAddUserForm && (
            <div className="admin-message error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {message && (
            <div className="admin-message success" style={{ marginBottom: '1rem' }}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="right-panel">
        <div className="section" style={{ marginBottom: 0 }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>Users List</h2>
          </div>

          {error && !showAddUserForm && (
            <div className="admin-message error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="admin-loading" style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
              Loading users...
            </div>
          ) : (
            <div className="admin-users-table">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Created</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td><strong>{u.username}</strong></td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{u.companyName || '-'}</td>
                        <td style={{ fontSize: '0.8125rem', color: '#718096' }}>{formatDate(u.createdAt as string)}</td>
                        <td style={{ fontSize: '0.8125rem', color: '#718096' }}>{formatDate(u.lastLogin as string)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

