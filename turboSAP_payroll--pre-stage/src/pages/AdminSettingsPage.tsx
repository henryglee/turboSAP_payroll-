/**
 * AdminSettingsPage - Placeholder for admin settings
 * Future: API keys, branding, system configuration
 */

import { AdminLayout } from '../components/layout/AdminLayout';
import {
  Settings,
  Key,
  Palette,
  Bell,
  Shield,
  Database,
  Wrench,
} from 'lucide-react';

const settingsSections = [
  {
    title: 'API Configuration',
    description: 'Manage API keys and integrations',
    icon: Key,
    status: 'Coming Soon',
  },
  {
    title: 'Branding',
    description: 'Customize logos, colors, and appearance',
    icon: Palette,
    status: 'Coming Soon',
  },
  {
    title: 'Notifications',
    description: 'Configure email and alert settings',
    icon: Bell,
    status: 'Coming Soon',
  },
  {
    title: 'Security',
    description: 'Password policies and authentication',
    icon: Shield,
    status: 'Coming Soon',
  },
  {
    title: 'Data Management',
    description: 'Backup, export, and data retention',
    icon: Database,
    status: 'Coming Soon',
  },
  {
    title: 'Advanced',
    description: 'System configuration and maintenance',
    icon: Wrench,
    status: 'Coming Soon',
  },
];

export function AdminSettingsPage() {
  return (
    <AdminLayout
      title="Settings"
      description="Configure platform settings and preferences"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="bg-white border border-gray-200 rounded-xl p-6 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-gray-100">
                  <Icon className="h-6 w-6 text-gray-400" />
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  {section.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {section.title}
              </h3>
              <p className="text-sm text-gray-500">
                {section.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700">Settings Coming Soon</p>
            <p className="text-sm text-gray-600 mt-1">
              Advanced configuration options will be available in future updates.
              For now, please contact support for any configuration changes.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
