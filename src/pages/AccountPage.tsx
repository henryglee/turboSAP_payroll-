/**
 * AccountPage - User account settings and profile
 * Accessible from sidebar "Account" link
 */

import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/auth';
import { User, Building2, Image } from 'lucide-react';

export function AccountPage() {
  const { user } = useAuthStore();

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
      </div>
    </DashboardLayout>
  );
}
