/**
 * AccountPage - User account settings and profile
 * Accessible from sidebar "Account" link
 */

import { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { User, Building2, Image, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { changePassword } from '../api/auth';

export function AccountPage() {
  const { user } = useAuthStore();
  
  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // Validation
    if (!passwordForm.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!passwordForm.newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess(response.message || 'Password changed successfully');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Account Settings"
      description="Manage your profile and company information"
      currentPath="/account"
    >
      <div className="space-y-6">
        {/* Account sections will be populated later */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Profile Information</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <p className="text-base">{user?.username}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <p className="text-base capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Company Information</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Company Name</label>
              <p className="text-base">{user?.companyName || 'Not set'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Image className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Company Logo</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Logo upload functionality will be added here
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Change Password</h2>
          </div>
          
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {/* Success Message */}
            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-700">{passwordSuccess}</p>
              </div>
            )}

            {/* Error Message */}
            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                placeholder="Re-enter new password"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors"
              >
                {passwordLoading ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>

            <p className="text-xs text-gray-500 pt-2">
              Note: You must provide your current password to change it. The system does not support password recovery.
            </p>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
