/**
 * DashboardPage - Main landing page after login
 * Matches the design from the provided screenshot
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import {
  Calendar,
  CreditCard,
  Building2,
  FileJson,
  ArrowRight,
  User,
  Bell,
} from 'lucide-react';

// Module cards matching the screenshot
const modules = [
  {
    id: 'payroll-areas',
    title: 'Payroll Areas',
    description: 'Define payroll frequencies and period parameters',
    icon: Calendar,
    route: '/chat',
    count: 0,
    status: 'not-started' as const,
  },
  {
    id: 'payment-methods',
    title: 'Payment Methods',
    description: 'Configure ACH, check, and paycard options',
    icon: CreditCard,
    route: '/payment-methods',
    count: 0,
    status: 'not-started' as const,
  },
  {
    id: 'export',
    title: 'JSON Export',
    description: 'Generate SAP-compatible configuration',
    icon: FileJson,
    route: '/export',
    action: 'Click to configure',
    status: 'not-started' as const,
  },
];

// Recent activity items matching screenshot
const recentActivity = [
  {
    id: 1,
    title: 'Payroll Area Created',
    description: 'Weekly payroll area "WK1" was added',
    timestamp: '2 minutes ago',
    icon: Calendar,
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 2,
    title: 'Payment Method Configured',
    description: 'ACH Direct Deposit enabled',
    timestamp: '15 minutes ago',
    icon: CreditCard,
    color: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    id: 3,
    title: 'Branch Added',
    description: 'San Francisco HQ branch configured',
    timestamp: '1 hour ago',
    icon: Building2,
    color: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  {
    id: 4,
    title: 'Team Member Invited',
    description: 'john.doe@acme.com joined the project',
    timestamp: '3 hours ago',
    icon: User,
    color: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Calculate progress (mock for now)
  const totalModules = modules.filter(m => m.id !== 'export').length;
  const completedModules = modules.filter(m => m.status === 'complete').length;
  const progress = Math.round((completedModules / totalModules) * 100);

  const getStatusBadge = (status: string) => {
    if (status === 'not-started') {
      return (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
          Not Started
        </span>
      );
    }
    if (status === 'in-progress') {
      return (
        <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        Completed
      </span>
    );
  };

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.username || 'Sarah'}`}
      description="Configure your SAP payroll migration settings"
      currentPath="/dashboard"
      statusIndicators={{
        payrollAreas: 'not-started',
        paymentMethods: 'not-started',
      }}
    >
      {/* Progress Indicator */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Progress:</span>
          <span className="text-sm font-semibold text-foreground">{progress}%</span>
        </div>
        <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
        <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="ml-auto">
          <span className="text-sm font-medium text-muted-foreground">Client</span>
        </div>
      </div>

      {/* Configuration Modules */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Configuration Modules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => navigate(module.route)}
                className="group relative bg-card border border-border rounded-lg p-6 hover:shadow-md hover:border-primary/50 transition-all duration-200 text-left"
              >
                {/* Icon & Status Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-secondary rounded-lg group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  {getStatusBadge(module.status)}
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {module.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {module.description}
                </p>

                {/* Count or Action */}
                <div className="flex items-center justify-between">
                  {module.action ? (
                    <span className="text-sm text-muted-foreground">
                      {module.action}
                    </span>
                  ) : (
                    <span className="text-3xl font-bold text-foreground">
                      {module.count}
                    </span>
                  )}
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Latest configuration changes
          </p>
        </div>

        <div className="space-y-3">
          {recentActivity.map((activity) => {
            const Icon = activity.icon;
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2.5 rounded-lg ${activity.color}`}>
                  <Icon className={`h-5 w-5 ${activity.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activity.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
